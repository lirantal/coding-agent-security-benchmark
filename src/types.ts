export type VulnType =
  | "sql-injection"
  | "xss"
  | "path-traversal"
  | "command-injection"
  | "hardcoded-credentials"
  | "insecure-deserialization"
  | "idor"
  | "xxe"
  | "ssrf"
  | "open-redirect"
  | "other";

export type Severity = "critical" | "high" | "medium" | "low";

export interface Vulnerability {
  id: string;
  type: VulnType;
  severity: Severity;
  file: string;
  line?: number;
  description: string;
}

export interface EvalCategory {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export const EVAL_CATEGORIES = {
  FIND_VULNS: {
    id: "find-vulns",
    name: "Find Vulnerabilities",
    description: "Agent identifies security vulnerabilities in code and reports findings",
  },
  FIX_VULNS: {
    id: "fix-vulns",
    name: "Fix Vulnerabilities",
    description: "Agent remediates security vulnerabilities by editing source files",
  },
} as const satisfies Record<string, EvalCategory>;

/** Union of all registered category id strings — expands automatically as categories are added. */
export type EvalCategoryId = typeof EVAL_CATEGORIES[keyof typeof EVAL_CATEGORIES]["id"];

export interface EvalTask {
  id: string;
  name: string;
  category: EvalCategory;
  /** Path to fixture directory (relative to project root) */
  fixture: string;
  /** System prompt to inject */
  systemPrompt?: string;
  /** Main prompt sent to agent */
  prompt: string;
  /** Ground-truth vulnerabilities in the fixture */
  knownVulns: Vulnerability[];
  /** Max agent turns allowed */
  maxTurns?: number;
}

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface RunConfig {
  id: string;
  name: string;
  model: string;
  mcpServers?: Record<string, MCPServerConfig>;
  maxTurns?: number;
}

export interface ToolCallRecord {
  tool: string;
  durationMs: number;
}

export interface BenchmarkMetrics {
  sessionDurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTurns: number;
  toolCalls: ToolCallRecord[];
  /** Aggregated per-tool stats */
  toolStats: Record<string, { count: number; totalDurationMs: number }>;
}

export interface FindVulnsDetails {
  agentFindings: Vulnerability[];
  truePositives: string[]; // vuln IDs correctly found
  falsePositives: number;
  falseNegatives: string[]; // vuln IDs missed
  precision: number;
  recall: number;
}

export interface FixVulnsDetails {
  vulnsAttempted: number;
  vulnsFixed: number;
  judgeNotes: string;
}

export interface EvalResult {
  taskId: string;
  taskName: string;
  runConfigId: string;
  runConfigName: string;
  score: number; // 0–1
  metrics: BenchmarkMetrics;
  details: FindVulnsDetails | FixVulnsDetails;
  timestamp: string;
  error?: string;
}
