import { readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { EVAL_CATEGORIES } from "../types.js";
import type { EvalTask, RunConfig, Vulnerability, EvalCategoryId } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");
const FIXTURES_DIR = resolve(PROJECT_ROOT, "fixtures");
const EVALS_DIR = resolve(PROJECT_ROOT, "evals");
const TASKS_DIR = resolve(EVALS_DIR, "tasks");
const RUN_CONFIGS_FILE = resolve(EVALS_DIR, "run-configs.json");

/** Shape of a task JSON file in evals/tasks/ */
interface TaskJson {
  id: string;
  name: string;
  /** Must match an EvalCategoryId ("find-vulns" | "fix-vulns") */
  category: EvalCategoryId;
  /** Name of the fixture subdirectory inside fixtures/ */
  fixture: string;
  /** Override the category's default system prompt */
  systemPrompt?: string;
  /** Override the category's default user prompt */
  prompt?: string;
  maxTurns?: number;
}

function loadVulns(fixtureName: string): Vulnerability[] {
  const vulnsPath = join(FIXTURES_DIR, `${fixtureName}.json`);
  let raw: { vulnerabilities: Vulnerability[] };
  try {
    raw = JSON.parse(readFileSync(vulnsPath, "utf-8"));
  } catch (err) {
    throw new Error(`Failed to read vulns.json for fixture "${fixtureName}" at ${vulnsPath}: ${err}`);
  }
  if (!Array.isArray(raw.vulnerabilities)) {
    throw new Error(`vulns.json for fixture "${fixtureName}" must have a top-level "vulnerabilities" array`);
  }
  return raw.vulnerabilities;
}

function resolveCategory(categoryId: string) {
  const category = Object.values(EVAL_CATEGORIES).find((c) => c.id === categoryId);
  if (!category) {
    const valid = Object.values(EVAL_CATEGORIES).map((c) => c.id).join(", ");
    throw new Error(`Unknown category id "${categoryId}". Valid values: ${valid}`);
  }
  return category;
}

export function loadEvalTasks(): EvalTask[] {
  let files: string[];
  try {
    files = readdirSync(TASKS_DIR).filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    throw new Error(`Cannot read tasks directory at ${TASKS_DIR}: ${err}`);
  }

  if (files.length === 0) {
    throw new Error(`No task JSON files found in ${TASKS_DIR}`);
  }

  return files.map((file) => {
    const filePath = join(TASKS_DIR, file);
    let taskJson: TaskJson;
    try {
      taskJson = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch (err) {
      throw new Error(`Failed to parse task file ${filePath}: ${err}`);
    }

    const { id, name, category: categoryId, fixture, systemPrompt, prompt, maxTurns } = taskJson;

    if (!id || !name || !categoryId || !fixture) {
      throw new Error(`Task file ${file} is missing required fields: id, name, category, fixture`);
    }

    const category = resolveCategory(categoryId);
    const knownVulns = loadVulns(fixture);
    const fixturePath = resolve(FIXTURES_DIR, fixture);

    return {
      id,
      name,
      category,
      fixture: fixturePath,
      systemPrompt: systemPrompt ?? category.defaultSystemPrompt,
      prompt: prompt ?? category.defaultPrompt,
      knownVulns,
      ...(maxTurns !== undefined && { maxTurns }),
    } satisfies EvalTask;
  });
}

export function loadRunConfigs(): RunConfig[] {
  let raw: RunConfig[];
  try {
    raw = JSON.parse(readFileSync(RUN_CONFIGS_FILE, "utf-8"));
  } catch (err) {
    throw new Error(`Failed to read run configs at ${RUN_CONFIGS_FILE}: ${err}`);
  }
  if (!Array.isArray(raw)) {
    throw new Error(`${RUN_CONFIGS_FILE} must be a JSON array of RunConfig objects`);
  }
  return raw;
}
