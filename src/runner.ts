import { query, type HookCallback } from "@anthropic-ai/claude-agent-sdk";
import { dirname } from "path";
import type { EvalTask, RunConfig, BenchmarkMetrics, ToolCallRecord } from "./types.js";

export interface RunOutput {
  finalText: string;
  metrics: BenchmarkMetrics;
  error?: string;
}

/**
 * Runs an eval task using the Claude Agent SDK and collects benchmark metrics.
 * Returns the agent's final text output and accumulated metrics.
 */
export async function runTask(
  task: EvalTask,
  config: RunConfig,
  cwd: string,
): Promise<RunOutput> {
  const toolCalls: ToolCallRecord[] = [];
  const toolStartTimes = new Map<string, number>();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTurns = 0;
  let finalText = "";

  // PreToolUse hook: record start time
  const preToolHook: HookCallback = async (input) => {
    const id = (input as any).tool_use_id ?? String(Date.now());
    toolStartTimes.set(id, Date.now());
    return {};
  };

  // PostToolUse hook: record completed tool call
  const postToolHook: HookCallback = async (input) => {
    const id = (input as any).tool_use_id ?? "";
    const tool = (input as any).tool_name ?? "unknown";
    const startTime = toolStartTimes.get(id) ?? Date.now();
    toolCalls.push({ tool, durationMs: Date.now() - startTime });
    toolStartTimes.delete(id);
    return {};
  };

  const sessionStart = Date.now();

  try {
    for await (const message of query({
      prompt: task.prompt,
      options: {
        cwd,
        model: config.model,
        maxTurns: task.maxTurns ?? config.maxTurns ?? 30,
        allowedTools: [
          "Read", "Glob", "Grep", "Bash", "Write", "Edit",
          // Allow all tools from every configured MCP server.
          // Derived from config so adding a server in run-configs.json needs no code change.
          ...Object.keys(config.mcpServers ?? {}).map((name) => `mcp__${name}__*`),
        ],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        // Restrict filesystem access to the fixture directory only.
        // allowWrite is a whitelist — writes outside cwd are rejected outright.
        // denyRead targets the parent directory (e.g. fixtures/) which contains
        // sibling ground-truth JSONs and other fixture dirs the agent shouldn't see.
        sandbox: {
          filesystem: {
            allowWrite: [cwd],
            denyRead: [dirname(cwd)],
          },
        },
        mcpServers: config.mcpServers,
        systemPrompt: task.systemPrompt,
        hooks: {
          PreToolUse: [{ matcher: ".*", hooks: [preToolHook] }],
          PostToolUse: [{ matcher: ".*", hooks: [postToolHook] }],
        },
      },
    })) {
      // Accumulate per-turn usage from assistant messages
      if (message.type === "assistant") {
        totalTurns++;
        const usage = (message as any).usage;
        if (usage) {
          totalInputTokens += usage.input_tokens ?? 0;
          totalOutputTokens += usage.output_tokens ?? 0;
        }
        // Capture the last text block as the final output
        const content = (message as any).message?.content ?? [];
        for (const block of content) {
          if (block.type === "text") finalText = block.text;
        }
      }

      // ResultMessage
      if ("result" in message) {
        const result = message as any;
        // Some SDK versions put usage on the result message
        if (result.usage) {
          totalInputTokens = result.usage.input_tokens ?? totalInputTokens;
          totalOutputTokens = result.usage.output_tokens ?? totalOutputTokens;
        }
        if (result.result) finalText = result.result;
      }
    }
  } catch (err) {
    return {
      finalText,
      metrics: buildMetrics(sessionStart, totalInputTokens, totalOutputTokens, totalTurns, toolCalls),
      error: String(err),
    };
  }

  return {
    finalText,
    metrics: buildMetrics(sessionStart, totalInputTokens, totalOutputTokens, totalTurns, toolCalls),
  };
}

function buildMetrics(
  sessionStart: number,
  inputTokens: number,
  outputTokens: number,
  turns: number,
  toolCalls: ToolCallRecord[],
): BenchmarkMetrics {
  const toolStats: Record<string, { count: number; totalDurationMs: number }> = {};
  for (const call of toolCalls) {
    if (!toolStats[call.tool]) toolStats[call.tool] = { count: 0, totalDurationMs: 0 };
    toolStats[call.tool].count++;
    toolStats[call.tool].totalDurationMs += call.durationMs;
  }

  return {
    sessionDurationMs: Date.now() - sessionStart,
    totalInputTokens: inputTokens,
    totalOutputTokens: outputTokens,
    totalTurns: turns,
    toolCalls,
    toolStats,
  };
}
