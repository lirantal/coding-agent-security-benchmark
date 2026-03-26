# Coding Agent Security Benchmark

## Project Purpose

Benchmarking framework that runs AI coding agents (primarily Claude Code via the TypeScript Agent SDK) against standardized security tasks, collecting metrics to compare:

- Different models (claude-opus-4-6 vs claude-sonnet-4-6 vs claude-haiku-4-5)
- Different MCP configurations (with/without security tools like Snyk, semgrep, etc.)
- Different system prompts and agent configs

## Primary Eval Categories

1. **find-vulns**: Given a codebase with known vulnerabilities, how many can the agent correctly identify?
2. **fix-vulns**: Given a codebase with known vulnerabilities, how many can the agent correctly fix?

## Tech Stack

- **Runtime**: TypeScript + Node 24, pnpm
- **Agent SDK**: `@anthropic-ai/claude-agent-sdk` (TypeScript) — wraps Claude Code CLI
- **Anthropic SDK**: `@anthropic-ai/sdk` — for token counting and direct API calls (scoring, judging)
- **Claude Code CLI**: available at `/home/node/.local/bin/claude`

## Architecture

```
src/
  types.ts          # Core interfaces + EVAL_CATEGORIES constant
  runner.ts         # Agent SDK wrapper — runs a task and collects metrics
  scorer.ts         # Scoring logic per eval category
  reporter.ts       # Output to console table + JSONL
  evals/
    loader.ts       # Scans evals/tasks/*.json + evals/run-configs.json at startup
  index.ts          # CLI entry point

evals/
  tasks/            # One JSON file per eval task — add a file to add a new task
    js-find-vulns.json
    js-fix-vulns.json
    python-find-vulns.json
  run-configs.json  # Array of RunConfig objects — edit to add/change model configs

fixtures/
  js-vulns.json     # Ground-truth vulnerability metadata (OUTSIDE agent cwd — loaded by loader)
  js-vulns/         # Intentionally vulnerable JavaScript (Express app)
    app.js          # Vulnerable code (SQL injection, XSS, path traversal, etc.)
  python-vulns.json # Ground-truth vulnerability metadata
  python-vulns/     # Intentionally vulnerable Python (Flask app)
    app.py

results/            # Benchmark output (JSONL files)
```

## Adding a New Eval Task (Open/Closed)

No source code changes required. Just:

1. Add a fixture directory `fixtures/<name>/` with the vulnerable code, and a sibling `fixtures/<name>.json` with the ground-truth vulnerability list
2. Drop a JSON file in `evals/tasks/<id>.json` with `id`, `name`, `category`, `fixture` fields
3. Run — the loader picks it up automatically

See TODO: `docs/benchmark-management.md` for a full guide.

## How the Agent SDK Is Used

The TypeScript Agent SDK runs Claude Code as a subprocess with a specified `cwd`, tools, and model. We wrap `query()` to collect metrics:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// Hooks capture per-tool timing via PreToolUse/PostToolUse
// AssistantMessage.usage gives per-turn token counts (accumulated for totals)
// Wall time measured from query start to ResultMessage
```

## Key Metric Collection Strategy

From the chat-summary.txt context:
- **Session-level tokens**: accumulated from `AssistantMessage.usage` fields (input + output per turn)
- **Per-tool timing**: PreToolUse/PostToolUse hooks with a Map tracking start times
- **Wall time**: `Date.now()` before/after the full `query()` loop
- **Token counting per tool call**: optional — use `anthropic.messages.countTokens()` on tool input/output content (adds latency, free but has RPM limits)

## Scoring Approach

### find-vulns
- Agent is asked to output findings as a JSON array with `type`, `file`, `line`, `severity`, `description`
- Parse the JSON from the agent's final output (look for `FINDINGS_JSON:` marker)
- Score = recall (found / total known) with precision penalty for false positives

### fix-vulns
- Agent runs on a temp copy of the fixture directory (to avoid permanent changes)
- After the agent run, use Claude API directly to judge the fixes
- Score = fraction of known vulns that were remediated

## Authentication

The Agent SDK uses `ANTHROPIC_API_KEY` from environment (injected by devcontainer). The CLI uses the same key.

## Running Benchmarks

```bash
pnpm run benchmark                    # all tasks, default configs
pnpm run benchmark:find               # only find-vulns tasks
pnpm run benchmark:fix                # only fix-vulns tasks
pnpm benchmark -- --config opus-only  # specific run config
pnpm benchmark -- --task js-find-vulns  # specific task
```

Results are saved to `results/benchmark-<timestamp>.jsonl`.

## Important Notes

- Fixtures are **intentionally vulnerable** code — they exist for security research/testing
- Each fixture has a sibling `fixtures/<name>.json` with ground-truth vulnerability metadata — kept outside the fixture directory so the agent cannot read the answer key
- Run configs define model + MCP servers — comparison across configs is the core benchmark value
- The `fix-vulns` eval works on temp copies; original fixtures are never modified

## TODO

- [x] Create `docs/benchmark-management.md` — guide for adding new eval tasks (fixture layout, vulns.json schema, task JSON fields, step-by-step walkthrough) and updating run configs (fields reference, MCP server example)
