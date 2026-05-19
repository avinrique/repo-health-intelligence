# Repo Health Intelligence

Walks a public Git repo's history, builds per-commit code knowledge graphs with tree-sitter, computes a composite health score with **five explainable subscores**, and renders a time-series dashboard with hotspot map, bus-factor analysis, architectural-drift tracking, knowledge-graph visualization, pre-merge health prediction, and on-click LLM narratives for dips.

Tested against [tarinagarwal/Edulume](https://github.com/tarinagarwal/Edulume) — 109 commits ingested in ~30s on an M2.

## Quick start

```bash
npm install --legacy-peer-deps      # tree-sitter peer alignment
npm run ingest -- https://github.com/tarinagarwal/Edulume
npm run dev
# open http://localhost:3000
```

Optional: set `AI_GATEWAY_API_KEY` in `.env.local` to enable LLM narratives. Without it, dip explanations use a deterministic rule-based fallback — no API calls made.

## Brief checklist

| Requirement | Status |
|---|---|
| 1. Repo ingestion — walks history, tree-sitter parse, per-commit graphs (nodes: files; edges: imports) | ✅ |
| 2. Health score — ≥4 explainable subscores | ✅ **5** (complexity drift, test coverage, hotspot risk, dependency rot, **arch drift**) |
| 3. Time-series dashboard — health trend annotated per PR; click dip → explain | ✅ |
| 4. Knowledge-graph diff between any two commits | ✅ |
| 5. Hotspot map — "where bugs live" heatmap | ✅ |
| Constraint: LLM usage cost-justified | ✅ user-triggered, cached per (sha, prev_sha), prompt is pre-computed deltas only — no source code |
| Demo on real repo | ✅ Edulume (109 commits) |
| **Bonus: Bus factor per module** | ✅ |
| **Bonus: Architectural drift detection** | ✅ cycles + orphans + max fan-in baselined |
| **Bonus: LLM "why did health drop" narrative** | ✅ |
| **Bonus: Pre-merge health prediction** | ✅ pick any branch, simulate merge, get predicted Δhealth |
| **Bonus: Multi-language support** | ✅ TS / TSX / JS / JSX / Python |
| **Plus: Force-directed knowledge-graph viz** | ✅ |
| **Plus: Circular dependency + orphan detection** | ✅ Tarjan SCC |

## How the health score works

`health = 25·(1 − drift) + 25·test_coverage + 20·(1 − hotspot_risk) + 15·(1 − rot) + 15·(1 − arch_drift)` → 0–100

All subscores normalize to `[0, 1]`. See `src/lib/scoring.ts` for the exact formulas.

| Subscore | What it captures |
|---|---|
| **complexity drift** | Per-commit average cyclomatic complexity vs the first analyzed commit, clamped to [0, 1]. |
| **test coverage** | Ratio of test files to source files (file-name heuristic — proxies coverage without running anything). |
| **hotspot risk** | Concentration (top-10 / total) + log-scaled intensity of `churn × complexity` per file. |
| **dependency rot** | `0.5·(numDeps / 80) + 0.5·(commits_since_package_json_change / 50)`, clamped. |
| **arch drift** | `0.4·cycle_growth + 0.3·orphan_growth + 0.3·max_fan_in_growth` vs baseline commit. |

## Dashboard tabs

- **Hotspots** — top files by `churn × complexity` at the selected commit
- **Bus factor** — module-level + file-level: who owns what %, and which files are single-owner
- **Architecture** — time-series of cycles, orphans, single-owner-file count; full list of cycles + orphans at selected commit
- **Predict PR** — choose any branch on the upstream repo, simulate it against main, see predicted health Δ and per-subscore impact
- **Knowledge graph** — force-directed canvas viz of the selected commit's import graph (node size ∝ √complexity, color by complexity bucket)
- **Graph diff** — node and edge diff between any two commits

## LLM usage policy

The only LLM call is `/api/explain`. It runs **only** when a user clicks a flagged dip in the dashboard, and the result is cached in `narratives(sha, prev_sha)`. The prompt sends pre-computed score deltas + top changed files + new hotspots — **no source code**, no per-function data — so token cost is flat regardless of repo size. Without an `AI_GATEWAY_API_KEY` the endpoint returns a deterministic rule-based summary instead.

Model defaults to `anthropic/claude-haiku-4-5` via Vercel AI Gateway. Output capped at 280 tokens.

## CLI

```bash
npm run ingest -- <repo-url> [--branch main] [--max 600] [--sample 1]
```

`--sample N` keeps every Nth commit (plus first and last); use for repos > 500 commits.

## API surface

| Endpoint | Purpose |
|---|---|
| `GET /api/scores` | full time-series + dip annotations |
| `GET /api/commits` | commit metadata |
| `GET /api/hotspots?sha=` | per-commit hotspots |
| `GET /api/diff?a=&b=` | structural diff between two commits |
| `GET /api/arch` | architectural drift time-series |
| `GET /api/cycles?sha=` | SCC list + orphans |
| `GET /api/busfactor?sha=` | per-file + per-module bus factor |
| `GET /api/graph?sha=` | nodes + edges for graph viz |
| `GET /api/branches` | list of remote branches |
| `GET /api/predict?branch=` | simulate merging the given branch HEAD |
| `POST /api/explain` | LLM narrative for a (sha, prev_sha) pair, cached |

## Architecture

```
scripts/ingest.ts       walks history, parses, computes everything, persists
src/lib/git.ts          simple-git wrapper
src/lib/parse.ts        tree-sitter parsers (ts/tsx/js/jsx/py) + cyclomatic complexity counter
src/lib/metrics.ts      per-file → per-commit aggregation
src/lib/scoring.ts      5 subscores + composite
src/lib/arch.ts         Tarjan SCC, orphan detection, fan-in/out, bus factor
src/lib/db.ts           SQLite schema
src/components/         Recharts + custom canvas force-directed graph
```

## Notes on deployment

Ingestion uses native modules (`better-sqlite3`, `tree-sitter` grammars) and must run locally / on a server, not in a Vercel serverless function. The Next.js read API can deploy fine if you swap the SQLite layer for Postgres.
