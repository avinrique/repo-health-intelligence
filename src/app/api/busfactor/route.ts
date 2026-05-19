import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  let sha = url.searchParams.get("sha");
  const d = db();
  if (!sha) {
    const latest = d.prepare("SELECT sha FROM commits ORDER BY idx DESC LIMIT 1").get() as { sha: string } | undefined;
    sha = latest?.sha ?? null;
  }
  if (!sha) return NextResponse.json({ sha: null, rows: [] });

  const rows = d.prepare(`
    SELECT path, factor, top_share, total_commits
    FROM bus_factor
    WHERE sha = ? AND total_commits >= 2
    ORDER BY factor ASC, top_share DESC, total_commits DESC
    LIMIT 200
  `).all(sha) as any[];

  // attach top author for each path
  const enriched = rows.map((r) => {
    const top = d.prepare(`SELECT author, commits FROM file_authors WHERE sha = ? AND path = ? ORDER BY commits DESC LIMIT 1`).get(sha, r.path) as any;
    return { ...r, top_author: top?.author || null, top_author_commits: top?.commits || 0 };
  });

  // module-level rollup: group by top dir
  const moduleAgg = new Map<string, { totalFiles: number; lowBusFiles: number; authors: Map<string, number> }>();
  for (const r of rows) {
    const mod = r.path.split("/").slice(0, 2).join("/") || ".";
    const m = moduleAgg.get(mod) || { totalFiles: 0, lowBusFiles: 0, authors: new Map<string, number>() };
    m.totalFiles++;
    if (r.factor <= 1) m.lowBusFiles++;
    moduleAgg.set(mod, m);
  }
  const allAuthors = d.prepare(`SELECT path, author, commits FROM file_authors WHERE sha = ?`).all(sha) as any[];
  for (const a of allAuthors) {
    const mod = a.path.split("/").slice(0, 2).join("/") || ".";
    const m = moduleAgg.get(mod);
    if (!m) continue;
    m.authors.set(a.author, (m.authors.get(a.author) || 0) + a.commits);
  }
  const modules = Array.from(moduleAgg.entries()).map(([module, m]) => {
    const sorted = Array.from(m.authors.entries()).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, n]) => s + n, 0) || 1;
    const half = total / 2;
    let acc = 0, factor = 0;
    for (const [, n] of sorted) { acc += n; factor++; if (acc > half) break; }
    return {
      module,
      total_files: m.totalFiles,
      low_bus_files: m.lowBusFiles,
      module_factor: factor,
      top_author: sorted[0]?.[0] || null,
      top_share: sorted[0] ? sorted[0][1] / total : 0,
      total_commits: total,
    };
  }).sort((a, b) => a.module_factor - b.module_factor || b.low_bus_files - a.low_bus_files);

  return NextResponse.json({ sha, files: enriched, modules });
}
