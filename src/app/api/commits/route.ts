import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = db().prepare(`
    SELECT c.sha, c.parent, c.author, c.email, c.ts, c.message, c.idx,
           s.health, s.complexity_drift, s.test_coverage, s.hotspot_risk, s.dependency_rot,
           s.total_files, s.total_loc, s.total_complexity
    FROM commits c
    JOIN scores s ON s.sha = c.sha
    ORDER BY c.idx ASC
  `).all();
  const repo = db().prepare("SELECT url, branch, ingested_at FROM repo WHERE id = 1").get();
  return NextResponse.json({ repo, commits: rows });
}
