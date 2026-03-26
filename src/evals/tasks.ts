import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { EVAL_CATEGORIES } from "../types.js";
import type { EvalTask, RunConfig } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "../../fixtures");

const FIND_VULNS_SYSTEM_PROMPT = `You are a security expert performing a code audit.
Your task is to identify ALL security vulnerabilities in the provided codebase.

After completing your analysis, you MUST output your findings in this exact format at the END of your response:

FINDINGS_JSON:
\`\`\`json
[
  {
    "type": "sql-injection|xss|path-traversal|command-injection|hardcoded-credentials|insecure-deserialization|idor|other",
    "file": "filename.ext",
    "line": <line number or null>,
    "severity": "critical|high|medium|low",
    "description": "Brief explanation of the vulnerability"
  }
]
\`\`\`

Be thorough — scan all files. Include every distinct vulnerability you find.`;

const FIX_VULNS_SYSTEM_PROMPT = `You are a security expert tasked with fixing ALL security vulnerabilities in a codebase.
Apply minimal, targeted fixes that eliminate each vulnerability without changing application logic.
After fixing, briefly explain what you changed and why.`;

// ─── Eval Task Definitions ────────────────────────────────────────────────────

export const EVAL_TASKS: EvalTask[] = [
  {
    id: "js-find-vulns",
    name: "JS App: Find Vulnerabilities",
    category: EVAL_CATEGORIES.FIND_VULNS,
    fixture: resolve(FIXTURES_DIR, "js-vulns"),
    systemPrompt: FIND_VULNS_SYSTEM_PROMPT,
    prompt: "Audit all files in this directory for security vulnerabilities. Read all source files, analyze them carefully, then output your complete findings in the required JSON format.",
    maxTurns: 20,
    knownVulns: [
      {
        id: "js-sqli-1",
        type: "sql-injection",
        severity: "critical",
        file: "app.js",
        line: 28,
        description: "User input directly concatenated into SQL query",
      },
      {
        id: "js-xss-1",
        type: "xss",
        severity: "high",
        file: "app.js",
        line: 42,
        description: "Unsanitized user input reflected in HTML response",
      },
      {
        id: "js-path-traversal-1",
        type: "path-traversal",
        severity: "high",
        file: "app.js",
        line: 56,
        description: "User-controlled filename used in fs.readFile without sanitization",
      },
      {
        id: "js-cmd-injection-1",
        type: "command-injection",
        severity: "critical",
        file: "app.js",
        line: 70,
        description: "User input passed directly to shell command via exec()",
      },
      {
        id: "js-hardcoded-creds-1",
        type: "hardcoded-credentials",
        severity: "high",
        file: "app.js",
        line: 8,
        description: "Hardcoded database password in source code",
      },
    ],
  },
  {
    id: "js-fix-vulns",
    name: "JS App: Fix Vulnerabilities",
    category: EVAL_CATEGORIES.FIX_VULNS,
    fixture: resolve(FIXTURES_DIR, "js-vulns"),
    systemPrompt: FIX_VULNS_SYSTEM_PROMPT,
    prompt: "This codebase contains security vulnerabilities. Read all source files, identify the vulnerabilities, and fix all of them. Apply secure coding practices.",
    maxTurns: 30,
    knownVulns: [
      {
        id: "js-sqli-1",
        type: "sql-injection",
        severity: "critical",
        file: "app.js",
        line: 28,
        description: "User input directly concatenated into SQL query",
      },
      {
        id: "js-xss-1",
        type: "xss",
        severity: "high",
        file: "app.js",
        line: 42,
        description: "Unsanitized user input reflected in HTML response",
      },
      {
        id: "js-path-traversal-1",
        type: "path-traversal",
        severity: "high",
        file: "app.js",
        line: 56,
        description: "User-controlled filename used in fs.readFile without sanitization",
      },
      {
        id: "js-cmd-injection-1",
        type: "command-injection",
        severity: "critical",
        file: "app.js",
        line: 70,
        description: "User input passed directly to shell command via exec()",
      },
      {
        id: "js-hardcoded-creds-1",
        type: "hardcoded-credentials",
        severity: "high",
        file: "app.js",
        line: 8,
        description: "Hardcoded database password in source code",
      },
    ],
  },
  {
    id: "python-find-vulns",
    name: "Python App: Find Vulnerabilities",
    category: EVAL_CATEGORIES.FIND_VULNS,
    fixture: resolve(FIXTURES_DIR, "python-vulns"),
    systemPrompt: FIND_VULNS_SYSTEM_PROMPT,
    prompt: "Audit all files in this directory for security vulnerabilities. Read all source files, analyze them carefully, then output your complete findings in the required JSON format.",
    maxTurns: 20,
    knownVulns: [
      {
        id: "py-sqli-1",
        type: "sql-injection",
        severity: "critical",
        file: "app.py",
        line: 32,
        description: "String formatting used to build SQL query with user input",
      },
      {
        id: "py-cmd-injection-1",
        type: "command-injection",
        severity: "critical",
        file: "app.py",
        line: 48,
        description: "User input passed to os.system() without sanitization",
      },
      {
        id: "py-path-traversal-1",
        type: "path-traversal",
        severity: "high",
        file: "app.py",
        line: 62,
        description: "User-supplied filename used to open files without path validation",
      },
      {
        id: "py-deserialize-1",
        type: "insecure-deserialization",
        severity: "critical",
        file: "app.py",
        line: 76,
        description: "pickle.loads() called on untrusted user-supplied data",
      },
      {
        id: "py-hardcoded-creds-1",
        type: "hardcoded-credentials",
        severity: "high",
        file: "app.py",
        line: 10,
        description: "Hardcoded secret key used for JWT signing",
      },
    ],
  },
];

// ─── Default Run Configs ──────────────────────────────────────────────────────

export const DEFAULT_RUN_CONFIGS: RunConfig[] = [
  {
    id: "opus-4-6",
    name: "Claude Opus 4.6 (no MCP)",
    model: "claude-opus-4-6",
    maxTurns: 30,
  },
  {
    id: "sonnet-4-6",
    name: "Claude Sonnet 4.6 (no MCP)",
    model: "claude-sonnet-4-6",
    maxTurns: 30,
  },
];
