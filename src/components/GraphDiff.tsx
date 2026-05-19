"use client";
import { useEffect, useState } from "react";

interface DiffData {
  a: string; b: string;
  nodes: { added: any[]; removed: any[]; changed: any[] };
  edges: { added: any[]; removed: any[] };
  counts: { addedNodes: number; removedNodes: number; changedNodes: number; addedEdges: number; removedEdges: number };
}

export default function GraphDiff({ a, b }: { a: string; b: string }) {
  const [data, setData] = useState<DiffData | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!a || !b || a === b) { setData(null); return; }
    setLoading(true);
    fetch(`/api/diff?a=${a}&b=${b}`).then((r) => r.json()).then((d) => { setData(d); setLoading(false); });
  }, [a, b]);
  if (a === b) return <div className="text-zinc-500 text-sm">Pick two different commits to diff.</div>;
  if (loading) return <div className="text-zinc-500 text-sm">Diffing…</div>;
  if (!data) return null;
  return (
    <div className="text-xs space-y-3">
      <div className="grid grid-cols-5 gap-2 text-center">
        <Cell label="+ nodes" value={data.counts.addedNodes} color="text-emerald-400" />
        <Cell label="− nodes" value={data.counts.removedNodes} color="text-red-400" />
        <Cell label="~ nodes" value={data.counts.changedNodes} color="text-amber-400" />
        <Cell label="+ edges" value={data.counts.addedEdges} color="text-emerald-400" />
        <Cell label="− edges" value={data.counts.removedEdges} color="text-red-400" />
      </div>
      <div>
        <div className="text-zinc-400 mb-1">Changed (top 10 by complexity Δ)</div>
        <div className="space-y-0.5 max-h-48 overflow-auto">
          {data.nodes.changed
            .slice()
            .sort((x, y) => Math.abs(y.dComplexity) - Math.abs(x.dComplexity))
            .slice(0, 10)
            .map((c) => (
              <div key={c.id} className="font-mono flex justify-between gap-2">
                <span className="truncate text-zinc-300" title={c.after.path}>{c.after.path}</span>
                <span className={c.dComplexity > 0 ? "text-red-400" : "text-emerald-400"}>
                  Δcx {c.dComplexity > 0 ? "+" : ""}{c.dComplexity} · Δloc {c.dLoc > 0 ? "+" : ""}{c.dLoc}
                </span>
              </div>
            ))}
          {!data.nodes.changed.length && <div className="text-zinc-600">(none)</div>}
        </div>
      </div>
      {data.nodes.added.length > 0 && (
        <div>
          <div className="text-zinc-400 mb-1">Added files (first 10)</div>
          <div className="space-y-0.5 max-h-32 overflow-auto">
            {data.nodes.added.slice(0, 10).map((n) => (
              <div key={n.id} className="font-mono text-emerald-300 truncate">+ {n.path}</div>
            ))}
          </div>
        </div>
      )}
      {data.nodes.removed.length > 0 && (
        <div>
          <div className="text-zinc-400 mb-1">Removed files (first 10)</div>
          <div className="space-y-0.5 max-h-32 overflow-auto">
            {data.nodes.removed.slice(0, 10).map((n) => (
              <div key={n.id} className="font-mono text-red-300 truncate">− {n.path}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-zinc-900 rounded border border-zinc-800 py-1.5">
      <div className={`text-base font-semibold ${color}`}>{value}</div>
      <div className="text-zinc-500 text-[10px] uppercase tracking-wide">{label}</div>
    </div>
  );
}
