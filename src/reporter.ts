import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { EvalResult, FindVulnsDetails, FixVulnsDetails } from "./types.js";

export function printResult(result: EvalResult): void {
  const isFindVulns = !result.error && "recall" in result.details;
  const scoreLabel = isFindVulns ? "Score (F1):" : "Score:     ";
  const status = result.error ? "ERROR" : `${(result.score * 100).toFixed(0)}%`;
  const m = result.metrics;
  const totalTokens = m.totalInputTokens + m.totalOutputTokens + m.totalCacheReadTokens + m.totalCacheCreationTokens;
  const durationSec = (m.sessionDurationMs / 1000).toFixed(1);

  const cacheDetail = (m.totalCacheReadTokens > 0 || m.totalCacheCreationTokens > 0)
    ? `  cache-read: ${m.totalCacheReadTokens.toLocaleString()}, cache-write: ${m.totalCacheCreationTokens.toLocaleString()}`
    : "";

  console.log(
    `\n${"─".repeat(70)}\n` +
    `Task:    ${result.taskName}\n` +
    `Config:  ${result.runConfigName}\n` +
    `${scoreLabel} ${status}\n` +
    `Tokens:  ${totalTokens.toLocaleString()} total  (in: ${m.totalInputTokens.toLocaleString()}, out: ${m.totalOutputTokens.toLocaleString()}${cacheDetail})\n` +
    `Time:    ${durationSec}s  |  Turns: ${m.totalTurns}  |  Files: ${m.filesScanned.length}\n`,
  );

  if (result.error) {
    console.log(`Error: ${result.error}\n`);
    return;
  }

  // Print task-specific details
  if ("recall" in result.details) {
    const d = result.details as FindVulnsDetails;
    console.log(
      `Recall:    ${(d.recall * 100).toFixed(0)}%  (${d.truePositives.length}/${d.truePositives.length + d.falseNegatives.length} known vulns found)\n` +
      `Precision: ${(d.precision * 100).toFixed(0)}%  (${d.falsePositives} false positives)\n` +
      `Missed:    ${d.falseNegatives.length > 0 ? d.falseNegatives.join(", ") : "none"}\n`,
    );
  } else {
    const d = result.details as FixVulnsDetails;
    console.log(
      `Fixed:  ${d.vulnsFixed}/${d.vulnsAttempted} vulnerabilities\n` +
      `Notes:  ${d.judgeNotes}\n`,
    );
  }

  // Print all tool stats sorted by call count
  const topTools = Object.entries(result.metrics.toolStats)
    .sort((a, b) => b[1].count - a[1].count);
  if (topTools.length > 0) {
    const totalCalls = topTools.reduce((sum, [, s]) => sum + s.count, 0);
    console.log(`All tools:  (${totalCalls} calls across ${topTools.length} tool types)`);
    for (const [tool, stats] of topTools) {
      const avgMs = (stats.totalDurationMs / stats.count).toFixed(0);
      const tokIn = stats.totalInputTokensEst.toLocaleString();
      const tokOut = stats.totalOutputTokensEst.toLocaleString();
      console.log(`  ${tool}: ${stats.count}x, avg ${avgMs}ms, ~${tokIn} in / ~${tokOut} out tokens (est)`);
    }
  }
}

export function saveResults(results: EvalResult[], outputDir: string): string {
  mkdirSync(outputDir, { recursive: true });
  const filename = `benchmark-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
  const filepath = join(outputDir, filename);

  for (const result of results) {
    appendFileSync(filepath, JSON.stringify(result) + "\n");
  }

  return filepath;
}

export function printSummaryTable(results: EvalResult[]): void {
  if (results.length === 0) return;

  console.log(`\n${"═".repeat(70)}`);
  console.log("BENCHMARK SUMMARY");
  console.log("═".repeat(70));

  const header = ["Task", "Config", "Score", "Tokens", "Time(s)"];
  const rows = results.map((r) => [
    r.taskId.slice(0, 24),
    r.runConfigId.slice(0, 18),
    r.error ? "ERROR" : `${(r.score * 100).toFixed(0)}%`,
    String(r.metrics.totalInputTokens + r.metrics.totalOutputTokens + r.metrics.totalCacheReadTokens + r.metrics.totalCacheCreationTokens),
    (r.metrics.sessionDurationMs / 1000).toFixed(1),
  ]);

  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)),
  );

  const fmt = (row: string[]) =>
    row.map((cell, i) => cell.padEnd(widths[i])).join("  ");

  console.log(fmt(header));
  console.log(widths.map((w) => "─".repeat(w)).join("  "));
  for (const row of rows) {
    console.log(fmt(row));
  }
  console.log();
}
