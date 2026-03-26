import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { EvalResult, FindVulnsDetails, FixVulnsDetails } from "./types.js";

export function printResult(result: EvalResult): void {
  const status = result.error ? "ERROR" : `${(result.score * 100).toFixed(0)}%`;
  const tokens = result.metrics.totalInputTokens + result.metrics.totalOutputTokens;
  const durationSec = (result.metrics.sessionDurationMs / 1000).toFixed(1);

  console.log(
    `\n${"─".repeat(70)}\n` +
    `Task:    ${result.taskName}\n` +
    `Config:  ${result.runConfigName}\n` +
    `Score:   ${status}\n` +
    `Tokens:  ${tokens.toLocaleString()} (in: ${result.metrics.totalInputTokens.toLocaleString()}, out: ${result.metrics.totalOutputTokens.toLocaleString()})\n` +
    `Time:    ${durationSec}s  |  Turns: ${result.metrics.totalTurns}\n`,
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

  // Print top tool stats
  const topTools = Object.entries(result.metrics.toolStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);
  if (topTools.length > 0) {
    console.log("Top tools:");
    for (const [tool, stats] of topTools) {
      console.log(`  ${tool}: ${stats.count}x, avg ${(stats.totalDurationMs / stats.count).toFixed(0)}ms`);
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
    String(r.metrics.totalInputTokens + r.metrics.totalOutputTokens),
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
