# Benchmark Management Guide

How to add new eval tasks, new fixtures, and new run configs — without touching source code.

## Table of Contents

1. [How the Plugin Architecture Works](#how-the-plugin-architecture-works)
2. [Adding a New Eval Task — Step-by-Step](#adding-a-new-eval-task--step-by-step)
   - [Step 1 — Create the fixture directory](#step-1--create-the-fixture-directory)
   - [Step 2 — Write vulns.json](#step-2--write-vulnsjson)
   - [Step 3 — Drop a task JSON file](#step-3--drop-a-task-json-file)
   - [Step 4 — Run and verify](#step-4--run-and-verify)
3. [Task JSON Reference](#task-json-reference)
4. [vulns.json Reference](#vulnsjson-reference)
5. [Updating Run Configs](#updating-run-configs)
   - [Adding a new model config](#adding-a-new-model-config)
   - [Adding an MCP server config](#adding-an-mcp-server-config)
6. [Run Config JSON Reference](#run-config-json-reference)
7. [Worked Example: Adding a Ruby Fixture](#worked-example-adding-a-ruby-fixture)
8. [Troubleshooting](#troubleshooting)

---

## How the Plugin Architecture Works

The benchmark uses a **directory-scanning loader** (`src/evals/loader.ts`). At startup, it:

1. Reads every `*.json` file in `evals/tasks/` — each file is one eval task
2. Reads `evals/run-configs.json` — an array of model/tool configurations
3. For each task, loads `knownVulns` from the fixture's `vulns.json` automatically
4. Resolves the `category` field from its id against the `EVAL_CATEGORIES` registry

```
evals/
  tasks/
    js-find-vulns.json     ← scanned automatically
    js-fix-vulns.json      ← scanned automatically
    python-find-vulns.json ← scanned automatically
    your-new-task.json     ← just drop it here, no code changes
  run-configs.json         ← edit this array to add/change configs

fixtures/
  js-vulns/
    app.js
    vulns.json             ← loaded automatically by the task's "fixture" field
  your-new-fixture/
    ...
    vulns.json
```

**Adding a new task = create two files.** Adding a new run config = edit one JSON array.

---

## Adding a New Eval Task — Step-by-Step

### Step 1 — Create the fixture directory

Create a subdirectory under `fixtures/` containing your intentionally vulnerable code. The directory name is the fixture identifier you'll reference in the task JSON.

```
fixtures/
  ruby-vulns/          ← new directory
    app.rb             ← your vulnerable source file(s)
    vulns.json         ← ground-truth (see Step 2)
```

The fixture can contain any number of source files in any structure. The agent will receive the fixture directory as its working directory and will explore it freely.

**Guidelines for writing vulnerable fixtures:**

- Each vulnerability should be unambiguous and clearly exploitable (not a code smell or best-practice issue)
- Assign each vulnerability to a specific file and line number
- Keep the fixture realistic — it should look like code a developer might actually write, not a CTF puzzle
- Cover a mix of severity levels (`critical`, `high`, `medium`) to make scoring more informative
- Intentional vulnerabilities only — don't accidentally introduce real ones that aren't in `vulns.json`

---

### Step 2 — Write vulns.json

Create `fixtures/<your-fixture>/vulns.json`. This is the **answer key** — the ground truth the scorer uses to determine whether the agent found or fixed each vulnerability.

```json
{
  "fixture": "ruby-vulns",
  "description": "Intentionally vulnerable Sinatra app for security benchmark testing",
  "vulnerabilities": [
    {
      "id": "rb-sqli-1",
      "type": "sql-injection",
      "severity": "critical",
      "file": "app.rb",
      "line": 22,
      "description": "User input interpolated directly into SQL query string"
    },
    {
      "id": "rb-cmd-injection-1",
      "type": "command-injection",
      "severity": "critical",
      "file": "app.rb",
      "line": 38,
      "description": "User-controlled parameter passed to backtick shell execution"
    },
    {
      "id": "rb-path-traversal-1",
      "type": "path-traversal",
      "severity": "high",
      "file": "app.rb",
      "line": 51,
      "description": "User-supplied filename used with File.read without path validation"
    }
  ]
}
```

**The `id` field is what the scorer tracks.** Make it unique, descriptive, and stable — if you change an id after running benchmarks, historical results won't match.

See the [vulns.json Reference](#vulnsjson-reference) for the full field list and valid values.

---

### Step 3 — Drop a task JSON file

Create a `.json` file in `evals/tasks/`. The filename determines alphabetical sort order (tasks are loaded in filename order) but otherwise doesn't matter. Convention: `<fixture>-<category>.json`.

**For a find-vulns task:**

```json
{
  "id": "ruby-find-vulns",
  "name": "Ruby App: Find Vulnerabilities",
  "category": "find-vulns",
  "fixture": "ruby-vulns",
  "maxTurns": 20
}
```

**For a fix-vulns task against the same fixture:**

```json
{
  "id": "ruby-fix-vulns",
  "name": "Ruby App: Fix Vulnerabilities",
  "category": "fix-vulns",
  "fixture": "ruby-vulns",
  "maxTurns": 30
}
```

The `fixture` field must exactly match the directory name under `fixtures/`. The `category` field must be one of the registered category ids (`"find-vulns"` or `"fix-vulns"`).

See the [Task JSON Reference](#task-json-reference) for all available fields.

---

### Step 4 — Run and verify

Use `--dry-run` to confirm the loader picks up your new task without running the agent:

```bash
pnpm run benchmark -- --dry-run
```

Expected output:
```
Benchmark: 5 task(s) × 2 config(s) = 10 run(s)
  • js-find-vulns [find-vulns]
  • js-fix-vulns [fix-vulns]
  • python-find-vulns [find-vulns]
  • ruby-find-vulns [find-vulns]      ← your new task
  • ruby-fix-vulns [fix-vulns]        ← your new task
  • opus-4-6: claude-opus-4-6
  • sonnet-4-6: claude-sonnet-4-6
```

If your task appears, run it for real:

```bash
# Just your new task, against a single config (fast for initial testing)
pnpm run benchmark -- --task ruby-find-vulns --config sonnet-4-6

# Both tasks together
pnpm run benchmark -- --task ruby-find-vulns
pnpm run benchmark -- --task ruby-fix-vulns
```

---

## Task JSON Reference

| Field | Required | Type | Description |
|---|---|---|---|
| `id` | Yes | `string` | Unique identifier. Used in `--task` CLI filter and in result files. |
| `name` | Yes | `string` | Human-readable label shown in console output. |
| `category` | Yes | `"find-vulns"` \| `"fix-vulns"` | Which eval category this task belongs to. |
| `fixture` | Yes | `string` | Subdirectory name under `fixtures/`. Must contain a `vulns.json`. |
| `maxTurns` | No | `number` | Max agent conversation turns. Defaults to the run config's `maxTurns`. Recommended: 20 for find-vulns, 30 for fix-vulns. |
| `systemPrompt` | No | `string` | Overrides the category's default system prompt. Omit to use the default. |
| `prompt` | No | `string` | Overrides the category's default user prompt. Omit to use the default. |

**When to override prompts:** The category defaults work well for most fixtures. Override only if your fixture has special characteristics — e.g., a multi-file project where you want to give the agent explicit instructions about which directory to scan, or a task that requires domain-specific context.

Example with a custom prompt:

```json
{
  "id": "java-find-vulns",
  "name": "Java App: Find Vulnerabilities",
  "category": "find-vulns",
  "fixture": "java-vulns",
  "maxTurns": 25,
  "prompt": "Audit all Java source files in src/main/java for security vulnerabilities. Pay special attention to deserialization and JNDI injection patterns. Read all .java files carefully, then output your complete findings in the required JSON format."
}
```

---

## vulns.json Reference

The top-level structure:

```json
{
  "fixture": "<directory name — informational only>",
  "description": "<human-readable description of the fixture>",
  "vulnerabilities": [ ... ]
}
```

Each entry in `vulnerabilities`:

| Field | Required | Type | Valid Values |
|---|---|---|---|
| `id` | Yes | `string` | Unique ID, stable across runs. Convention: `<lang prefix>-<type>-<number>` e.g. `rb-sqli-1` |
| `type` | Yes | `VulnType` | See table below |
| `severity` | Yes | `Severity` | `"critical"`, `"high"`, `"medium"`, `"low"` |
| `file` | Yes | `string` | Relative path from fixture root, e.g. `"app.rb"` or `"src/handlers/user.rb"` |
| `line` | No | `number` | Line number where the vulnerability occurs. Used for display, not for scoring. |
| `description` | Yes | `string` | One-sentence explanation of what makes this code vulnerable. |

**Valid `type` values:**

| Value | When to use |
|---|---|
| `"sql-injection"` | User input embedded in a SQL query (string concatenation, template, format string) |
| `"xss"` | Unsanitized user input reflected in HTML output |
| `"path-traversal"` | User-controlled filename/path used to access files without sanitization |
| `"command-injection"` | User input passed to a shell command, exec, eval, or similar |
| `"hardcoded-credentials"` | API keys, passwords, tokens, or secrets embedded in source code |
| `"insecure-deserialization"` | Deserializing untrusted data with unsafe formats (pickle, Java ObjectInputStream, etc.) |
| `"idor"` | Insecure Direct Object Reference — accessing resources without authorization checks |
| `"xxe"` | XML External Entity injection via an XML parser |
| `"ssrf"` | Server-Side Request Forgery — user-controlled URL used in a server-side HTTP request |
| `"open-redirect"` | User-controlled redirect target without validation |
| `"other"` | Any vulnerability that doesn't fit the above categories |

**Scoring note:** The scorer matches findings by `type`. If your fixture has two SQL injections, give each its own entry with unique `id`s — they will be tracked and scored independently.

---

## Updating Run Configs

Run configs live in `evals/run-configs.json` — a plain JSON array. Edit this file to add, remove, or modify configurations.

### Adding a new model config

Append an entry to the array:

```json
[
  {
    "id": "opus-4-6",
    "name": "Claude Opus 4.6 (no MCP)",
    "model": "claude-opus-4-6",
    "maxTurns": 30
  },
  {
    "id": "sonnet-4-6",
    "name": "Claude Sonnet 4.6 (no MCP)",
    "model": "claude-sonnet-4-6",
    "maxTurns": 30
  },
  {
    "id": "haiku-4-5",
    "name": "Claude Haiku 4.5 (cheapest)",
    "model": "claude-haiku-4-5",
    "maxTurns": 20
  }
]
```

Verify with dry-run:
```bash
pnpm run benchmark -- --dry-run
# Should now show three config lines
```

Run only that config against all tasks:
```bash
pnpm run benchmark -- --config haiku-4-5
```

### Adding an MCP server config

MCP (Model Context Protocol) servers give the agent access to external tools — security scanners, static analysis engines, etc. This is the primary mechanism for comparing "bare" Claude vs Claude augmented with a security tool.

```json
{
  "id": "sonnet-with-semgrep",
  "name": "Claude Sonnet 4.6 + semgrep",
  "model": "claude-sonnet-4-6",
  "maxTurns": 30,
  "mcpServers": {
    "semgrep": {
      "command": "npx",
      "args": ["@semgrep/mcp"]
    }
  }
}
```

Another example — Snyk MCP with an API token from the environment:

```json
{
  "id": "sonnet-with-snyk",
  "name": "Claude Sonnet 4.6 + Snyk",
  "model": "claude-sonnet-4-6",
  "maxTurns": 30,
  "mcpServers": {
    "snyk": {
      "command": "npx",
      "args": ["snyk-mcp"],
      "env": {
        "SNYK_TOKEN": "${SNYK_TOKEN}"
      }
    }
  }
}
```

> **Note:** Environment variable interpolation in `env` values is handled by the Agent SDK at runtime. Make sure the variable is set in your shell before running.

To compare a bare model against the same model with an MCP tool, keep both configs and run them together:

```bash
pnpm run benchmark -- --config sonnet-4-6 --category find-vulns
pnpm run benchmark -- --config sonnet-with-semgrep --category find-vulns
# Then compare their scores in results/
```

---

## Run Config JSON Reference

Each entry in `evals/run-configs.json`:

| Field | Required | Type | Description |
|---|---|---|---|
| `id` | Yes | `string` | Unique identifier. Used in `--config` CLI filter. |
| `name` | Yes | `string` | Human-readable label shown in console output and result files. |
| `model` | Yes | `string` | Anthropic model ID, e.g. `"claude-opus-4-6"`, `"claude-sonnet-4-6"`, `"claude-haiku-4-5"`. |
| `maxTurns` | No | `number` | Max conversation turns for this config. Overridden per-task by the task's `maxTurns` if set. |
| `mcpServers` | No | `object` | Map of MCP server name → `MCPServerConfig`. Omit for a bare model run. |

Each `MCPServerConfig`:

| Field | Required | Type | Description |
|---|---|---|---|
| `command` | Yes | `string` | The executable to run (e.g. `"npx"`, `"uvx"`, `"/path/to/server"`). |
| `args` | No | `string[]` | Arguments passed to the command. |
| `env` | No | `object` | Environment variables to set for the server process. |

---

## Worked Example: Adding a Ruby Fixture

Here is the full sequence for adding a Ruby/Sinatra fixture with two eval tasks (find + fix).

**Files to create:**

```
fixtures/ruby-vulns/app.rb          ← vulnerable Sinatra app
fixtures/ruby-vulns/vulns.json      ← ground truth
evals/tasks/ruby-find-vulns.json    ← find task descriptor
evals/tasks/ruby-fix-vulns.json     ← fix task descriptor
```

**`fixtures/ruby-vulns/vulns.json`:**
```json
{
  "fixture": "ruby-vulns",
  "description": "Intentionally vulnerable Sinatra app",
  "vulnerabilities": [
    {
      "id": "rb-sqli-1",
      "type": "sql-injection",
      "severity": "critical",
      "file": "app.rb",
      "line": 22,
      "description": "User input interpolated directly into SQL query string"
    },
    {
      "id": "rb-cmd-injection-1",
      "type": "command-injection",
      "severity": "critical",
      "file": "app.rb",
      "line": 38,
      "description": "User-controlled parameter passed to backtick shell execution"
    }
  ]
}
```

**`evals/tasks/ruby-find-vulns.json`:**
```json
{
  "id": "ruby-find-vulns",
  "name": "Ruby App: Find Vulnerabilities",
  "category": "find-vulns",
  "fixture": "ruby-vulns",
  "maxTurns": 20
}
```

**`evals/tasks/ruby-fix-vulns.json`:**
```json
{
  "id": "ruby-fix-vulns",
  "name": "Ruby App: Fix Vulnerabilities",
  "category": "fix-vulns",
  "fixture": "ruby-vulns",
  "maxTurns": 30
}
```

**Verify and run:**
```bash
# Confirm both tasks appear
pnpm run benchmark -- --dry-run

# Run find task with one model to sanity-check scoring
pnpm run benchmark -- --task ruby-find-vulns --config sonnet-4-6

# Run the full matrix for your new fixture only
pnpm run benchmark -- --task ruby-find-vulns
pnpm run benchmark -- --task ruby-fix-vulns
```

That's it. No source code changes required.

---

## Troubleshooting

**"Cannot read tasks directory"**
- Confirm `evals/tasks/` exists and contains at least one `.json` file.

**"Failed to parse task file ..."**
- Your task JSON has a syntax error. Validate it with `node -e "JSON.parse(require('fs').readFileSync('evals/tasks/your-file.json', 'utf8'))"`.

**"Unknown category id ..."**
- The `category` field in your task JSON must be exactly `"find-vulns"` or `"fix-vulns"` (lowercase, hyphenated).

**"Failed to read vulns.json for fixture ..."**
- The `fixture` field in your task JSON doesn't match any directory name under `fixtures/`.
- Make sure `fixtures/<your-fixture>/vulns.json` exists.

**"`vulnerabilities` must be an array"**
- Your `vulns.json` is missing the top-level `"vulnerabilities"` key, or it's not an array.

**Task appears in dry-run but scores 0 / recall 0**
- The agent ran but found nothing. Check that your fixture's vulnerable code is genuinely readable by the agent (no encoding issues, file permissions, etc.).
- Check that the `type` values in `vulns.json` exactly match the valid `VulnType` strings — a typo here means no match.

**"No matching tasks found. Available: ..."**
- The `--task` id you passed doesn't match any loaded task. Run `--dry-run` to see what ids are loaded.

**"No matching configs found. Available: ..."**
- The `--config` id you passed doesn't match any entry in `evals/run-configs.json`.
