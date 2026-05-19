import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface NodeRec { id: string; kind: string; path: string; name: string; loc: number; complexity: number; lang: string | null }
interface EdgeRec { src: string; dst: string; kind: string }

export async function GET(req: Request) {
  const url = new URL(req.url);
  const a = url.searchParams.get("a");
  const b = url.searchParams.get("b");
  if (!a || !b) return NextResponse.json({ error: "need ?a=<sha>&b=<sha>" }, { status: 400 });
  const d = db();
  const nodesA = d.prepare(`SELECT id, kind, path, name, loc, complexity, lang FROM nodes WHERE sha = ?`).all(a) as NodeRec[];
  const nodesB = d.prepare(`SELECT id, kind, path, name, loc, complexity, lang FROM nodes WHERE sha = ?`).all(b) as NodeRec[];
  const edgesA = d.prepare(`SELECT src, dst, kind FROM edges WHERE sha = ?`).all(a) as EdgeRec[];
  const edgesB = d.prepare(`SELECT src, dst, kind FROM edges WHERE sha = ?`).all(b) as EdgeRec[];

  const mapA = new Map(nodesA.map((n) => [n.id, n]));
  const mapB = new Map(nodesB.map((n) => [n.id, n]));
  const added: NodeRec[] = [];
  const removed: NodeRec[] = [];
  const changed: { id: string; before: NodeRec; after: NodeRec; dLoc: number; dComplexity: number }[] = [];
  for (const n of nodesB) {
    if (!mapA.has(n.id)) added.push(n);
    else {
      const prev = mapA.get(n.id)!;
      if (prev.loc !== n.loc || prev.complexity !== n.complexity) {
        changed.push({ id: n.id, before: prev, after: n, dLoc: n.loc - prev.loc, dComplexity: n.complexity - prev.complexity });
      }
    }
  }
  for (const n of nodesA) if (!mapB.has(n.id)) removed.push(n);

  const edgeKey = (e: EdgeRec) => `${e.src}->${e.dst}:${e.kind}`;
  const setA = new Set(edgesA.map(edgeKey));
  const setB = new Set(edgesB.map(edgeKey));
  const addedEdges = edgesB.filter((e) => !setA.has(edgeKey(e)));
  const removedEdges = edgesA.filter((e) => !setB.has(edgeKey(e)));

  return NextResponse.json({
    a, b,
    nodes: { added, removed, changed },
    edges: { added: addedEdges, removed: removedEdges },
    counts: {
      addedNodes: added.length,
      removedNodes: removed.length,
      changedNodes: changed.length,
      addedEdges: addedEdges.length,
      removedEdges: removedEdges.length,
    },
  });
}
