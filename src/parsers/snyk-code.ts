import type { FindingRecord } from "./index.js";

// SARIF structure emitted by `snyk code test --json`
interface SarifOutput {
  runs?: Array<{
    results?: Array<{
      ruleId?: string;
      level?: string;
      message?: { text?: string };
      locations?: Array<{
        physicalLocation?: {
          artifactLocation?: { uri?: string };
          region?: { startLine?: number };
        };
      }>;
    }>;
  }>;
}

/**
 * Maps a Snyk Code ruleId (e.g. "javascript/SqlInjection") to our VulnType enum.
 * Mirrors the jq mapping used in manual analysis.
 */
function mapRuleId(ruleId: string): string {
  const id = ruleId.toLowerCase();
  if (/sqli|sqlinjection/.test(id)) return "sql-injection";
  if (/xss/.test(id)) return "xss";
  // "PT" suffix pattern covers javascript/PT; "pathtraversal" covers longer names
  if (/pathtraversal|pt$/.test(id)) return "path-traversal";
  if (/commandinjection/.test(id)) return "command-injection";
  if (/hardcoded/.test(id)) return "hardcoded-credentials";
  if (/deserializ/.test(id)) return "insecure-deserialization";
  if (/idor|insecuredirectobject/.test(id)) return "idor";
  return "other";
}

/**
 * Maps SARIF severity level to our Severity enum.
 * Snyk Code uses error/warning/note — it does not emit "critical".
 */
function mapLevel(level: string): string {
  if (level === "error") return "high";
  if (level === "warning") return "medium";
  if (level === "note") return "low";
  return "medium";
}

/**
 * Parses the JSON output of `snyk code test --json` into FindingRecord[].
 * Handles both zero-exit (no findings) and non-zero-exit (findings present) stdout.
 */
export function parseSnykCodeOutput(stdout: string): FindingRecord[] {
  if (!stdout.trim()) return [];

  let sarif: SarifOutput;
  try {
    sarif = JSON.parse(stdout);
  } catch {
    return [];
  }

  const results = sarif.runs?.[0]?.results;
  if (!Array.isArray(results)) return [];

  return results
    .filter((r) => r.ruleId)
    .map((r) => ({
      type: mapRuleId(r.ruleId!),
      file: r.locations?.[0]?.physicalLocation?.artifactLocation?.uri ?? "",
      line: r.locations?.[0]?.physicalLocation?.region?.startLine,
      severity: mapLevel(r.level ?? ""),
      description: r.message?.text ?? "",
    }));
}
