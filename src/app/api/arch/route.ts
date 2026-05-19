import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const d = db();
  const series = d.prepare(`
    SELECT c.sha, c.idx, c.ts, c.message,
           s.arch_drift, s.num_orphans, s.num_cycles, s.mean_fan_in, s.mean_fan_out, s.bus_factor_low,
           s.total_files
    FROM commits c JOIN scores s ON s.sha = c.sha
    ORDER BY c.idx ASC
  `).all();
  return NextResponse.json({ series });
}
