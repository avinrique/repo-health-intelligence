import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = db().prepare(`
    SELECT c.sha, c.idx, c.ts, c.author, c.message,
           s.health, s.complexity_drift, s.test_coverage, s.hotspot_risk, s.dependency_rot,
           s.total_files, s.total_loc, s.total_complexity
    FROM commits c JOIN scores s ON s.sha = c.sha
    ORDER BY c.idx ASC
  `).all() as any[];

  // identify dips for PR annotations: drop >= 3 points vs previous health
  const annotations: { sha: string; idx: number; delta: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const delta = rows[i].health - rows[i - 1].health;
    if (delta <= -3) annotations.push({ sha: rows[i].sha, idx: rows[i].idx, delta: +delta.toFixed(1) });
  }

  return NextResponse.json({ series: rows, annotations });
}
