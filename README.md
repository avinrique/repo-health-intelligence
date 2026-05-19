# Repo Health Intelligence

Walks a public Git repo's history, builds per-commit code knowledge graphs with tree-sitter, computes a composite health score with explainable subscores, and renders a time-series dashboard with hotspot map and graph-diff view.

## Quick start

```bash
npm install --legacy-peer-deps      # tree-sitter peer alignment
npm run ingest -- https://github.com/tarinagarwal/Edulume
npm run dev
# open http://localhost:3000
```

Optional: set `AI_GATEWAY_API_KEY` in `.env.local` to enable LLM narratives. Without it, dip explanations use a deterministic fallback (no calls made).

## How the health score works

`health = 30·(1 - complexity_drift) + 30·test_coverage + 20·(1 - hotspot_risk) + 20·(1 - dependency_rot)`

All subscores normalize to `[0, 1]`. See `src/lib/scoring.ts` for the exact formulas and weights.

| Subscore | What it captures |
|---|---|
| **complexity drift** | Per-commit average cyclomatic complexity vs the first analyzed commit, clamped to [0, 1]. |
| **test coverage** | Ratio of test files to source files (file-name heuristic — proxies coverage without running anything). |
| **hotspot risk** | Concentration (top-10 / total) + log-scaled intensity of `churn × complexity` per file. |
| **dependency rot** | `0.5·(numDeps / 80) + 0.5·(commits_since_package_json_change / 50)`, clamped. |

## LLM usage policy

The only LLM call is `/api/explain`. It runs **only** when a user clicks a flagged dip in the dashboard, and the result is cached in `narratives(sha, prev_sha)`. The prompt sends pre-computed score deltas + top changed files + new hotspots — no source code, no per-function data — so token cost is flat regardless of repo size. Without an `AI_GATEWAY_API_KEY` the endpoint returns a deterministic rule-based summary.

Model defaults to `anthropic/claude-haiku-4-5` via Vercel AI Gateway. Cap is 280 output tokens.

## CLI

```bash
npm run ingest -- <repo-url> [--branch main] [--max 600] [--sample 1]
```

`--sample N` keeps every Nth commit (plus first and last); useful for repos > 500 commits.

## Architecture

```
scripts/ingest.ts       walks history, parses, persists
src/lib/git.ts          simple-git wrapper
src/lib/parse.ts        tree-sitter parsers (ts/tsx/js/jsx/py) + cyclomatic complexity counter
src/lib/metrics.ts      per-file -> per-commit aggregation
src/lib/scoring.ts      subscores + composite
src/lib/db.ts           SQLite schema
src/app/api/scores      time-series + dip annotations
src/app/api/hotspots    per-commit hotspot list
src/app/api/diff        graph diff between any two commits
src/app/api/explain     LLM narrative (cached, on-click only)
src/components/         dashboard UI (Recharts)
```

## Constraints met

- ≥ 4 explainable subscores ✅
- LLM call is user-triggered, cached, and prompt size is bounded ✅
- Multi-language (TS / TSX / JS / JSX / Python) ✅
- Graph diff between any two commits ✅
- Hotspot heatmap ✅
