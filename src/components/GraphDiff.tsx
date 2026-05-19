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
  if (a === b) return <div className="text-[var(--text-faint)] text-sm">Pick two different commits to diff.</div>;
  if (loading) return <div className="text-[var(--text-muted)] text-sm flex items-center gap-2">
    <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] health-pulse" />
    diffing graphs …
  </div>;
  if (!data) return null;
  return (
    <div className="text-xs space-y-4">
      <div className="grid grid-cols-5 gap-2 text-center">
        <Cell label="+ nodes" value={data.counts.addedNodes} color="var(--good)" />
        <Cell label="− nodes" value={data.counts.removedNodes} color="var(--bad)" />
        <Cell label="~ nodes" value={data.counts.changedNodes} color="var(--warn)" />
        <Cell label="+ edges" value={data.counts.addedEdges} color="var(--good)" />
        <Cell label="− edges" value={data.counts.removedEdges} color="var(--bad)" />
      </div>
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">Changed (top 10 by complexity Δ)</div>
        <div className="space-y-0.5 max-h-56 overflow-auto pr-1">
          {data.nodes.changed
            .slice()
            .sort((x, y) => Math.abs(y.dComplexity) - Math.abs(x.dComplexity))
            .slice(0, 10)
            .map((c) => (
              <div key={c.id} className="flex justify-between gap-2 px-1 py-0.5 rounded hover:bg-white/[0.025]">
                <span className="font-mono text-[12px] text-[var(--text)] truncate" title={c.after.path}>{c.after.path}</span>
                <span className="font-mono tabular-nums whitespace-nowrap text-[11px]" style={{ color: c.dComplexity > 0 ? "var(--bad)" : "var(--good)" }}>
                  Δcx {c.dComplexity > 0 ? "+" : ""}{c.dComplexity} · Δloc {c.dLoc > 0 ? "+" : ""}{c.dLoc}
                </span>
              </div>
            ))}
          {!data.nodes.changed.length && <div className="text-[var(--text-faint)]">(none)</div>}
        </div>
      </div>
      {(data.nodes.added.length > 0 || data.nodes.removed.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.nodes.added.length > 0 && (
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-1">Added files (first 10)</div>
              <div className="font-mono space-y-0 max-h-36 overflow-auto">
                {data.nodes.added.slice(0, 10).map((n) => (
                  <div key={n.id} className="text-[12px] text-[var(--good)] truncate">+ {n.path}</div>
                ))}
              </div>
            </div>
          )}
          {data.nodes.removed.length > 0 && (
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-1">Removed files (first 10)</div>
              <div className="font-mono space-y-0 max-h-36 overflow-auto">
                {data.nodes.removed.slice(0, 10).map((n) => (
                  <div key={n.id} className="text-[12px] text-[var(--bad)] truncate">− {n.path}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] py-2">
      <div className="text-lg font-semibold tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[var(--text-faint)] text-[10px] uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}
