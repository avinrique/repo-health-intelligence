import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { cloneOrOpen, checkout, changedFiles } from "@/lib/git";
import { parseFile } from "@/lib/parse";
import { aggregate } from "@/lib/metrics";
import { score } from "@/lib/scoring";
import { computeArch } from "@/lib/arch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

function resolveImport(fromPath: string, spec: string, fileSet: Set<string>): string | null {
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
  const baseDir = path.posix.dirname(fromPath);
  const joined = path.posix.normalize(path.posix.join(baseDir, spec));
  const candidates = [
    joined, `${joined}.ts`, `${joined}.tsx`, `${joined}.js`, `${joined}.jsx`, `${joined}.py`,
    `${joined}/index.ts`, `${joined}/index.tsx`, `${joined}/index.js`, `${joined}/index.jsx`, `${joined}/__init__.py`,
  ];
  for (const c of candidates) if (fileSet.has(c)) return c;
  return null;
}

function readDeps(cwd: string): { numDeps: number; raw: string } {
  const pkgPath = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgPath)) return { numDeps: 0, raw: "" };
  try {
    const raw = fs.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw);
    return {
      numDeps: (pkg.dependencies ? Object.keys(pkg.dependencies).length : 0)
             + (pkg.devDependencies ? Object.keys(pkg.devDependencies).length : 0)
             + (pkg.peerDependencies ? Object.keys(pkg.peerDependencies).length : 0),
      raw,
    };
  } catch { return { numDeps: 0, raw: "" }; }
}

/**
 * Predict what the health score *would* be if the HEAD of `?branch=foo` were the
 * current state, using churn/baseline accumulated from the ingested main history.
 * No new history is walked — only the file-content snapshot of the requested ref.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const branch = url.searchParams.get("branch");
  if (!branch) return NextResponse.json({ error: "need ?branch=<name>" }, { status: 400 });

  const d = db();
  const repo = d.prepare("SELECT url, branch FROM repo WHERE id = 1").get() as { url: string; branch: string } | undefined;
  if (!repo) return NextResponse.json({ error: "no repo ingested yet" }, { status: 400 });

  // gather churn + baselines from history
  const firstCommit = d.prepare("SELECT sha FROM commits ORDER BY idx ASC LIMIT 1").get() as { sha: string } | undefined;
  const lastCommit = d.prepare("SELECT sha FROM commits ORDER BY idx DESC LIMIT 1").get() as { sha: string } | undefined;
  if (!firstCommit || !lastCommit) return NextResponse.json({ error: "no commits" }, { status: 400 });
  const baselineRow = d.prepare("SELECT total_complexity, total_files, num_cycles, num_orphans, mean_fan_in FROM scores WHERE sha = ?").get(firstCommit.sha) as any;
  const lastRow = d.prepare("SELECT * FROM scores WHERE sha = ?").get(lastCommit.sha) as any;
  const baselineAvgComplexity = baselineRow.total_files > 0 ? baselineRow.total_complexity / baselineRow.total_files : 0;
  const baselineArch = {
    numCycles: baselineRow.num_cycles,
    numOrphans: baselineRow.num_orphans,
    maxFanIn: Math.round(baselineRow.mean_fan_in * 3),
    numNodes: baselineRow.total_files,
  };
  const churnByPath = new Map<string, number>();
  const allHotspots = d.prepare("SELECT path, churn FROM hotspots").all() as any[];
  for (const h of allHotspots) {
    const prev = churnByPath.get(h.path) || 0;
    if (h.churn > prev) churnByPath.set(h.path, h.churn);
  }

  // Walk full history once more to recover churn for ALL files (hotspots only stored top-10 per commit).
  // Cheap: just count commits per file.
  const { git, cwd } = await cloneOrOpen(repo.url, repo.branch);
  try {
    const log = await git.raw(["log", "--all", "--name-only", "--pretty=format:"]);
    for (const line of log.split("\n")) {
      const f = line.trim();
      if (!f) continue;
      if (!PARSE_EXTS.has(path.extname(f).toLowerCase())) continue;
      churnByPath.set(f, (churnByPath.get(f) || 0) + 1);
    }
  } catch {}

  // fetch all branches so the requested ref is available locally, then check it out
  try {
    await git.raw(["fetch", "origin", `${branch}:${branch}`]).catch(() => undefined);
    await checkout(git, branch);
  } catch (e: any) {
    return NextResponse.json({ error: `cannot checkout '${branch}': ${e?.message || e}` }, { status: 400 });
  }

  // parse
  const files = listSourceFiles(cwd);
  const parsed: any[] = [];
  const complexityByPath = new Map<string, number>();
  for (const rel of files) {
    let src: string;
    try { src = fs.readFileSync(path.join(cwd, rel), "utf8"); } catch { continue; }
    const r = parseFile(rel, src);
    if (!r) continue;
    parsed.push(r);
    complexityByPath.set(rel, r.complexity);
  }

  const fileSet = new Set(parsed.map((p) => p.path));
  const archEdges: { src: string; dst: string }[] = [];
  for (const p of parsed) {
    for (const imp of p.imports) {
      const target = resolveImport(p.path, imp, fileSet);
      if (target) archEdges.push({ src: p.path, dst: target });
    }
  }
  const arch = computeArch({ paths: parsed.map((p) => p.path), edges: archEdges });
  const agg = aggregate(parsed);
  const deps = readDeps(cwd);

  const predicted = score({
    agg, baselineAvgComplexity, churnByPath, complexityByPath,
    numDeps: deps.numDeps, commitsSinceDepsChange: lastRow.commits_since_deps_change,
    arch: { numCycles: arch.cycles.length, numOrphans: arch.orphans.length, maxFanIn: arch.maxFanIn, numNodes: arch.numNodes },
    baselineArch,
  });

  // restore to main so other operations stay consistent
  try { await checkout(git, repo.branch); } catch {}

  const currentHealth = lastRow.health;
  const newFiles = parsed.filter((p) => !d.prepare("SELECT 1 FROM nodes WHERE sha = ? AND id = ?").get(lastCommit.sha, `file:${p.path}`)).map((p) => p.path).slice(0, 10);

  return NextResponse.json({
    branch,
    base: { sha: lastCommit.sha, health: currentHealth, complexity_drift: lastRow.complexity_drift, test_coverage: lastRow.test_coverage, hotspot_risk: lastRow.hotspot_risk, dependency_rot: lastRow.dependency_rot, arch_drift: lastRow.arch_drift },
    predicted: {
      health: predicted.health,
      complexity_drift: predicted.complexityDrift,
      test_coverage: predicted.testCoverage,
      hotspot_risk: predicted.hotspotRisk,
      dependency_rot: predicted.dependencyRot,
      arch_drift: predicted.archDrift,
    },
    delta: predicted.health - currentHealth,
    summary: {
      files: agg.totalFiles,
      loc: agg.totalLoc,
      complexity: agg.totalComplexity,
      cycles: arch.cycles.length,
      orphans: arch.orphans.length,
      newFiles,
    },
  });
}
