"use client";

interface Hotspot { path: string; churn: number; complexity: number; risk: number }

export default function Hotspots({ data }: { data: Hotspot[] }) {
  if (!data?.length) return <div className="text-zinc-500 text-sm">No hotspots yet.</div>;
  const max = Math.max(...data.map((d) => d.risk));
  return (
    <div className="space-y-1.5">
      {data.slice(0, 20).map((h) => {
        const pct = (h.risk / max) * 100;
        const color = pct > 66 ? "bg-red-500/70" : pct > 33 ? "bg-amber-500/70" : "bg-emerald-500/70";
        return (
          <div key={h.path} className="text-xs">
            <div className="flex justify-between gap-2 mb-0.5">
              <span className="font-mono text-zinc-300 truncate" title={h.path}>{h.path}</span>
              <span className="text-zinc-500 whitespace-nowrap">churn {h.churn} · cx {h.complexity} · risk {h.risk.toFixed(0)}</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded overflow-hidden">
              <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
