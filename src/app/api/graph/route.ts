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
  if (!sha) return NextResponse.json({ sha: null, nodes: [], edges: [] });
  const nodes = d.prepare(`SELECT id, kind, path, name, loc, complexity, lang FROM nodes WHERE sha = ?`).all(sha);
  const edges = d.prepare(`SELECT src, dst, kind FROM edges WHERE sha = ?`).all(sha);
  return NextResponse.json({ sha, nodes, edges });
}
