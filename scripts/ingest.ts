#!/usr/bin/env tsx
/**
 * Ingest a public git repo: walk commits, parse files, compute scores per commit,
 * store everything in SQLite. Includes arch metrics + bus factor + cycles + orphans.
 *
 * Usage:
 *   npm run ingest -- <repo-url> [--branch main] [--max 600] [--sample 1]
 */
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { db } from "../src/lib/db";
import { cloneOrOpen, listCommits, fillParents, checkout, changedFiles } from "../src/lib/git";
import { parseFile } from "../src/lib/parse";
import { aggregate } from "../src/lib/metrics";
import { score } from "../src/lib/scoring";
import { computeArch, busFactor } from "../src/lib/arch";
import type { FileMetric } from "../src/lib/types";

interface Args { url: string; branch: string; max: number; sample: number }

function parseArgs(): Args {
  const a = process.argv.slice(2);
  if (!a.length) {
    console.error("usage: ingest <repo-url> [--branch main] [--max 600] [--sample 1]");
    process.exit(1);
  }
  const url = a[0];
  const get = (flag: string, def: string) => {
    const i = a.indexOf(flag);
    return i >= 0 ? a[i + 1] : def;
  };
  return {
    url,
    branch: get("--branch", "main"),
    max: parseInt(get("--max", "600"), 10),
    sample: parseInt(get("--sample", "1"), 10),
  };
}

const PARSE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"]);
const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "out", "coverage",
  ".turbo", ".cache", "venv", ".venv", "__pycache__", ".pytest_cache",
]);
const MAX_FILE_BYTES = 500_000;

function listSourceFiles(cwd: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string) => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      const r = rel ? path.posix.join(rel, e.name) : e.name;
      if (e.isDirectory()) walk(full, r);
      else if (e.isFile() && PARSE_EXTS.has(path.extname(e.name).toLowerCase())) {
        try { if (fs.statSync(full).size > MAX_FILE_BYTES) continue; } catch { continue; }
        out.push(r);
      }
    }
  };
  walk(cwd, "");
  return out;
}

function readDeps(cwd: string): { numDeps: number; raw: string } {
  const pkgPath = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgPath)) return { numDeps: 0, raw: "" };
  try {
    const raw = fs.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw);
    const d = pkg.dependencies ? Object.keys(pkg.dependencies).length : 0;
    const dd = pkg.devDependencies ? Object.keys(pkg.devDependencies).length : 0;
    const pd = pkg.peerDependencies ? Object.keys(pkg.peerDependencies).length : 0;
    return { numDeps: d + dd + pd, raw };
  } catch { return { numDeps: 0, raw: "" }; }
}

function resolveImport(fromPath: string, spec: string, fileSet: Set<string>): string | null {
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
  const baseDir = path.posix.dirname(fromPath);
  const joined = path.posix.normalize(path.posix.join(baseDir, spec));
  const candidates = [
    joined,
    `${joined}.ts`, `${joined}.tsx`, `${joined}.js`, `${joined}.jsx`, `${joined}.py`,
    `${joined}/index.ts`, `${joined}/index.tsx`, `${joined}/index.js`, `${joined}/index.jsx`,
    `${joined}/__init__.py`,
  ];
  for (const c of candidates) if (fileSet.has(c)) return c;
  return null;
}

async function main() {
  const args = parseArgs();
  console.log(`[ingest] repo=${args.url} branch=${args.branch} max=${args.max} sample=${args.sample}`);

  const { git, cwd } = await cloneOrOpen(args.url, args.branch);
  let commits = await listCommits(git, args.branch, args.max);
  commits = await fillParents(git, commits);

  if (args.sample > 1 && commits.length > 2) {
    const kept: typeof commits = [];
    for (let i = 0; i < commits.length; i++) {
      if (i === 0 || i === commits.length - 1 || i % args.sample === 0) kept.push(commits[i]);
    }
    commits = kept;
  }
  console.log(`[ingest] ${commits.length} commits to analyze`);

  const d = db();
  d.exec("DELETE FROM scores; DELETE FROM hotspots; DELETE FROM nodes; DELETE FROM edges; DELETE FROM commits; DELETE FROM narratives; DELETE FROM file_authors; DELETE FROM bus_factor; DELETE FROM cycles; DELETE FROM orphans;");
  d.prepare(`INSERT OR REPLACE INTO repo(id, url, branch, ingested_at) VALUES (1, ?, ?, ?)`)
    .run(args.url, args.branch, Math.floor(Date.now() / 1000));

  const ins = {
    commit: d.prepare(`INSERT INTO commits(sha, parent, author, email, ts, message, idx) VALUES (?, ?, ?, ?, ?, ?, ?)`),
    score: d.prepare(`INSERT INTO scores(sha, health, complexity_drift, test_coverage, hotspot_risk, dependency_rot, arch_drift, total_files, total_loc, total_complexity, test_files, source_files, num_deps, commits_since_deps_change, num_orphans, num_cycles, mean_fan_in, mean_fan_out, bus_factor_low) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    hotspot: d.prepare(`INSERT OR REPLACE INTO hotspots(sha, path, churn, complexity, risk) VALUES (?, ?, ?, ?, ?)`),
    node: d.prepare(`INSERT OR REPLACE INTO nodes(sha, id, kind, path, name, lang, loc, complexity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
    edge: d.prepare(`INSERT OR REPLACE INTO edges(sha, src, dst, kind) VALUES (?, ?, ?, ?)`),
    fauthor: d.prepare(`INSERT OR REPLACE INTO file_authors(sha, path, author, commits) VALUES (?, ?, ?, ?)`),
    bf: d.prepare(`INSERT OR REPLACE INTO bus_factor(sha, path, factor, top_share, total_commits) VALUES (?, ?, ?, ?, ?)`),
    cyc: d.prepare(`INSERT OR REPLACE INTO cycles(sha, cycle_id, member, size) VALUES (?, ?, ?, ?)`),
    orphan: d.prepare(`INSERT OR REPLACE INTO orphans(sha, path) VALUES (?, ?)`),
  };

  const churnByPath = new Map<string, number>();
  // authorCommitsByFile[path][author] = cumulative commits by that author touching that file
  const authorCommitsByFile = new Map<string, Map<string, number>>();
  let baselineAvgComplexity = 0;
  let baselineArch = { numCycles: 0, numOrphans: 0, maxFanIn: 0, numNodes: 0 };
  let prevDepsRaw = "";
  let commitsSinceDepsChange = 0;

  for (let i = 0; i < commits.length; i++) {
    const c = commits[i];
    const t0 = performance.now();
    await checkout(git, c.sha);

    // bump churn AND per-file author counts using changed files from this commit
    const diff = await changedFiles(git, c.sha, c.parent);
    for (const f of diff) {
      if (!PARSE_EXTS.has(path.extname(f).toLowerCase())) continue;
      churnByPath.set(f, (churnByPath.get(f) || 0) + 1);
      const m = authorCommitsByFile.get(f) || new Map<string, number>();
      m.set(c.author, (m.get(c.author) || 0) + 1);
      authorCommitsByFile.set(f, m);
    }

    // parse current tree
    const files = listSourceFiles(cwd);
    const parsed: FileMetric[] = [];
    const complexityByPath = new Map<string, number>();
    for (const rel of files) {
      const full = path.join(cwd, rel);
      let src: string;
      try { src = fs.readFileSync(full, "utf8"); } catch { continue; }
      const r = parseFile(rel, src);
      if (!r) continue;
      parsed.push(r);
      complexityByPath.set(rel, r.complexity);
    }

    // build internal import edges
    const fileSet = new Set(parsed.map((p) => p.path));
    const archEdges: { src: string; dst: string }[] = [];
    for (const p of parsed) {
      for (const imp of p.imports) {
        const target = resolveImport(p.path, imp, fileSet);
        if (target) archEdges.push({ src: p.path, dst: target });
      }
    }
    const archPaths = parsed.map((p) => p.path);
    const archMetrics = computeArch({ paths: archPaths, edges: archEdges });

    const agg = aggregate(parsed);
    if (i === 0) {
      baselineAvgComplexity = agg.avgComplexity;
      baselineArch = {
        numCycles: archMetrics.cycles.length,
        numOrphans: archMetrics.orphans.length,
        maxFanIn: archMetrics.maxFanIn,
        numNodes: archMetrics.numNodes,
      };
    }

    const deps = readDeps(cwd);
    if (deps.raw && deps.raw !== prevDepsRaw) {
      commitsSinceDepsChange = 0;
      prevDepsRaw = deps.raw;
    } else {
      commitsSinceDepsChange++;
    }

    const s = score({
      agg, baselineAvgComplexity, churnByPath, complexityByPath,
      numDeps: deps.numDeps, commitsSinceDepsChange,
      arch: { numCycles: archMetrics.cycles.length, numOrphans: archMetrics.orphans.length, maxFanIn: archMetrics.maxFanIn, numNodes: archMetrics.numNodes },
      baselineArch,
    });

    // bus factor per file (for live files only)
    const bfRows: { path: string; factor: number; topShare: number; totalCommits: number }[] = [];
    let busLow = 0;
    for (const p of parsed) {
      const ac = authorCommitsByFile.get(p.path);
      if (!ac || ac.size === 0) continue;
      const bf = busFactor(ac);
      bfRows.push({ path: p.path, ...bf });
      if (bf.factor <= 1 && bf.totalCommits >= 3) busLow++;
    }

    const tx = d.transaction(() => {
      ins.commit.run(c.sha, c.parent, c.author, c.email, c.ts, c.message, i);
      ins.score.run(
        c.sha, s.health, s.complexityDrift, s.testCoverage, s.hotspotRisk, s.dependencyRot, s.archDrift,
        agg.totalFiles, agg.totalLoc, agg.totalComplexity, agg.testFiles, agg.sourceFiles,
        deps.numDeps, commitsSinceDepsChange,
        archMetrics.orphans.length, archMetrics.cycles.length, archMetrics.meanFanIn, archMetrics.meanFanOut,
        busLow
      );
      for (const h of s.hotspots) ins.hotspot.run(c.sha, h.path, h.churn, h.complexity, h.risk);
      for (const p of parsed) {
        ins.node.run(c.sha, `file:${p.path}`, "file", p.path, path.basename(p.path), p.lang, p.loc, p.complexity);
      }
      for (const e of archEdges) ins.edge.run(c.sha, `file:${e.src}`, `file:${e.dst}`, "import");
      // file_authors snapshot (only for live files)
      for (const p of parsed) {
        const ac = authorCommitsByFile.get(p.path);
        if (!ac) continue;
        for (const [author, count] of ac) ins.fauthor.run(c.sha, p.path, author, count);
      }
      for (const r of bfRows) ins.bf.run(c.sha, r.path, r.factor, r.topShare, r.totalCommits);
      archMetrics.cycles.forEach((cyc, idx) => {
        for (const m of cyc) ins.cyc.run(c.sha, idx, m, cyc.length);
      });
      for (const o of archMetrics.orphans) ins.orphan.run(c.sha, o);
    });
    tx();

    const ms = (performance.now() - t0).toFixed(0);
    console.log(
      `[${i + 1}/${commits.length}] ${c.sha.slice(0, 7)} files=${agg.totalFiles} health=${s.health.toFixed(1)} ` +
      `(drift=${s.complexityDrift.toFixed(2)} hot=${s.hotspotRisk.toFixed(2)} arch=${s.archDrift.toFixed(2)}) ` +
      `cyc=${archMetrics.cycles.length} orph=${archMetrics.orphans.length} busLow=${busLow} — ${ms}ms`
    );
  }

  console.log("[ingest] done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
