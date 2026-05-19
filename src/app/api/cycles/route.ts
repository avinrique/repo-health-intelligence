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
  if (!sha) return NextResponse.json({ sha: null, cycles: [], orphans: [] });

  const rows = d.prepare(`SELECT cycle_id, member, size FROM cycles WHERE sha = ? ORDER BY size DESC, cycle_id ASC`).all(sha) as any[];
  const cycleMap = new Map<number, { id: number; size: number; members: string[] }>();
  for (const r of rows) {
    const c = cycleMap.get(r.cycle_id) || { id: r.cycle_id, size: r.size, members: [] };
    c.members.push(r.member);
    cycleMap.set(r.cycle_id, c);
  }
  const cycles = Array.from(cycleMap.values()).sort((a, b) => b.size - a.size);

  const orphans = d.prepare(`SELECT path FROM orphans WHERE sha = ? ORDER BY path ASC`).all(sha) as { path: string }[];

  return NextResponse.json({ sha, cycles, orphans });
}
