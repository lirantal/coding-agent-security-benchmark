import { cpSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { runTask } from "./runner.js";
import {
  scoreFindVulns,
  findVulnsScore,
  scoreFixVulns,
  fixVulnsScore,
} from "./scorer.js";
import { printResult, printSummaryTable, saveResults } from "./reporter.js";
import { loadEvalTasks, loadRunConfigs } from "./evals/loader.js";
import { EVAL_CATEGORIES } from "./types.js";
import type { EvalCategoryId, EvalResult, EvalTask, RunConfig } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = resolve(__dirname, "../results");
const TMP_DIR = resolve(__dirname, "../.tmp-fixtures");

// ─── CLI Argument Parsing ─────────────────────────────────────────────────────

const KNOWN_CATEGORY_IDS = Object.values(EVAL_CATEGORIES).map((c) => c.id);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: {
    category?: EvalCategoryId;
    task?: string;
    config?: string;
    dryRun: boolean;
  } = { dryRun: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--category" && args[i + 1]) {
      const val = args[++i];
      if (!KNOWN_CATEGORY_IDS.includes(val as EvalCategoryId)) {
        console.error(`Unknown category "${val}". Available: ${KNOWN_CATEGORY_IDS.join(", ")}`);
        process.exit(1);
      }
      opts.category = val as EvalCategoryId;
    } else if (args[i] === "--task" && args[i + 1]) opts.task = args[++i];
    else if (args[i] === "--config" && args[i + 1]) opts.config = args[++i];
    else if (args[i] === "--dry-run") opts.dryRun = true;
  }
  return opts;
}

// ─── Task Runner ──────────────────────────────────────────────────────────────

async function runEval(task: EvalTask, config: RunConfig): Promise<EvalResult> {
  const timestamp = new Date().toISOString();

  console.log(`\nRunning: ${task.name} | ${config.name}`);

  let cwd: string;
  let cleanupTmp = false;

  if (task.category.id === EVAL_CATEGORIES.FIX_VULNS.id) {
    // Work on a temp copy so we don't modify the original fixture
    cwd = join(TMP_DIR, `${task.id}-${config.id}-${Date.now()}`);
    mkdirSync(cwd, { recursive: true });
    cpSync(task.fixture, cwd, { recursive: true });
    cleanupTmp = true;
  } else {
    // find-vulns: read-only, use fixture directly
    cwd = task.fixture;
  }

  try {
    const { finalText, metrics, error } = await runTask(task, config, cwd);

    if (error) {
      return {
        taskId: task.id,
        taskName: task.name,
        runConfigId: config.id,
        runConfigName: config.name,
        score: 0,
        metrics,
        details: { agentFindings: [], truePositives: [], falsePositives: 0, falseNegatives: task.knownVulns.map((v) => v.id), precision: 0, recall: 0 },
        timestamp,
        error,
      };
    }

    if (task.category.id === EVAL_CATEGORIES.FIND_VULNS.id) {
      const details = scoreFindVulns(finalText, task);
      const score = findVulnsScore(details);
      return { taskId: task.id, taskName: task.name, runConfigId: config.id, runConfigName: config.name, score, metrics, details, timestamp };
    } else {
      const details = await scoreFixVulns(cwd, task);
      const score = fixVulnsScore(details);
      return { taskId: task.id, taskName: task.name, runConfigId: config.id, runConfigName: config.name, score, metrics, details, timestamp };
    }
  } finally {
    if (cleanupTmp) {
      try {
        rmSync(cwd, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  const EVAL_TASKS = loadEvalTasks();
  const DEFAULT_RUN_CONFIGS = loadRunConfigs();

  // Filter tasks
  let tasks = EVAL_TASKS;
  if (opts.category) tasks = tasks.filter((t) => t.category.id === opts.category);
  if (opts.task) tasks = tasks.filter((t) => t.id === opts.task);

  // Filter configs
  let configs = DEFAULT_RUN_CONFIGS;
  if (opts.config) configs = configs.filter((c) => c.id === opts.config);

  if (tasks.length === 0) {
    console.error("No matching tasks found. Available:", EVAL_TASKS.map((t) => t.id).join(", "));
    process.exit(1);
  }
  if (configs.length === 0) {
    console.error("No matching configs found. Available:", DEFAULT_RUN_CONFIGS.map((c) => c.id).join(", "));
    process.exit(1);
  }

  console.log(`\nBenchmark: ${tasks.length} task(s) × ${configs.length} config(s) = ${tasks.length * configs.length} run(s)`);
  for (const task of tasks) {
    console.log(`  ${task.id}  [${task.category.id}]`);
    for (let i = 0; i < configs.length; i++) {
      const prefix = i === configs.length - 1 ? "  └─" : "  ├─";
      console.log(`${prefix} ${configs[i].id}: ${configs[i].model}`);
    }
  }

  if (opts.dryRun) {
    console.log("\nDry run — exiting.");
    return;
  }

  mkdirSync(TMP_DIR, { recursive: true });

  const results: EvalResult[] = [];

  for (const config of configs) {
    for (const task of tasks) {
      const result = await runEval(task, config);
      printResult(result);
      results.push(result);
    }
  }

  printSummaryTable(results);

  const outputPath = saveResults(results, RESULTS_DIR);
  console.log(`\nResults saved to: ${outputPath}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
