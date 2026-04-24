# Static benchmark report (`public/`)

This folder holds a **single-file HTML report** that visualizes rows from a benchmark **JSONL** result file. The chart styling is tuned to match a clean lab-style bar chart (light grid, rounded bars, one highlighted series vs neutral comparison bars).

## Files

| File | Purpose |
|------|---------|
| `benchmark-report.html` | Self-contained report: embedded JSON rows + inline CSS + SVG charts drawn in the browser. |
| `README.md` | How the HTML was produced and how to regenerate it from a new JSONL export. |

No build step or server is required. Open the HTML file directly in a browser (double-click, or `file://` / static hosting).

## How `benchmark-report.html` was created

1. **Source data**  
   One benchmark run produced `results/benchmark-2026-04-24T11-21-37-863Z.jsonl`. That file is **newline-delimited JSON**: each line is one complete JSON object (one row per task × run configuration).

2. **Rows used**  
   For this report, both lines from that file were copied verbatim. They share the same `taskId` (`js-find-vulns`) and compare:
   - **Claude Sonnet 4.6 (no MCP)** — `runConfigType`: `model`
   - **Snyk Code SAST** — `runConfigType`: `command`

3. **Embedding in HTML**  
   The full JSON for each line was pasted into the `BENCHMARK_ROWS` array inside `benchmark-report.html` (inside the `<script>` block). The page script parses that array and builds three SVG charts:
   - **Composite score** — `score` (0–1, shown as percent).
   - **Session duration** — `metrics.sessionDurationMs` (linear scale, bar labels shown as seconds when ≥ 1000 ms).
   - **Recall and precision** — `details.recall` and `details.precision` as grouped bars per run.

4. **Styling**  
   Layout and colors are **inline CSS** in the same file (`:root` variables for bar colors, typography, grid). SVG elements use classes for grid lines and labels so you can adjust appearance in one place.

## How to create this report again from a bare JSONL file

### Option A — Manual (no tools)

1. Run your benchmark so it writes a new file under `results/`, e.g. `results/benchmark-<timestamp>.jsonl`.
2. Open the JSONL in an editor. Copy **only the lines** you want on the chart (same `taskId` is easiest to compare apples-to-apples).
3. Open `public/benchmark-report.html`.
4. Replace the contents of the `BENCHMARK_ROWS` array with valid JavaScript array elements:
   - Each line of JSONL becomes one array element (the whole JSON object).
   - Ensure **double quotes** inside the JSON stay valid; the object sits inside `[ ... ]` separated by commas.
5. Save and open `benchmark-report.html` in a browser.

### Option B — Quick copy with `sed` / shell (read-only on JSONL)

To print specific lines (e.g. lines 1–2) for pasting:

```bash
sed -n '1,2p' results/benchmark-2026-04-24T11-21-37-863Z.jsonl
```

Wrap the printed lines in `[` `]` and add commas between objects if you paste into `BENCHMARK_ROWS`.

### Option C — `jq` to emit a JS array snippet

If `jq` is installed, you can turn the whole file into a minified JSON array for embedding:

```bash
jq -s '.' results/benchmark-2026-04-24T11-21-37-863Z.jsonl
```

Copy the output into `const BENCHMARK_ROWS = ` ... `;` in the HTML (still valid JS for numeric/boolean/string fields).

### Fields the page expects

Each row should include at least:

| Field | Used for |
|-------|-----------|
| `taskName`, `taskId` | Header / subtitle |
| `timestamp` | Footer meta |
| `runConfigName` | Bar labels |
| `score` | Score chart |
| `metrics.sessionDurationMs` | Duration chart |
| `details.recall`, `details.precision` | Grouped recall/precision chart |

If `details` is missing, the script will throw; extend the script if you add runs without those fields.

### Ordering

The **first** row in `BENCHMARK_ROWS` is drawn with the **highlight** (terracotta) bar color; remaining rows use the **neutral** gray. Put the primary baseline (e.g. your agent) first and the comparator (e.g. Snyk) second.

## Privacy / portability

The embedded JSON may contain **paths** (e.g. `filesScanned`) from the machine that ran the benchmark. For public sharing, strip or redact those fields in the copy you embed, or post-process the JSONL before pasting.
