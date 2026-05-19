"use client";

interface Hotspot { path: string; churn: number; complexity: number; risk: number }

export default function Hotspots({ data }: { data: Hotspot[] }) {
  if (!data?.length) return <div className="text-[var(--text-faint)] text-sm">No hotspots yet.</div>;
  const max = Math.max(...data.map((d) => d.risk));
  return (
    <div className="space-y-2">
      <div className="text-[11px] text-[var(--text-muted)] mb-1">
        Risk = <span className="font-mono">churn × complexity</span>. Bars normalize to the worst file at this commit.
      </div>
      {data.slice(0, 20).map((h, i) => {
        const pct = (h.risk / max) * 100;
        const tone = pct > 66 ? "bg-[var(--bad)]" : pct > 33 ? "bg-[var(--warn)]" : "bg-[var(--good)]";
        return (
          <div key={h.path} className="group">
            <div className="flex items-baseline gap-3 justify-between mb-1">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-[10px] text-[var(--text-faint)] tabular-nums">#{i + 1}</span>
                <span className="font-mono text-[12.5px] text-[var(--text)] truncate" title={h.path}>{h.path}</span>
              </div>
              <div className="text-[11px] text-[var(--text-muted)] whitespace-nowrap font-mono tabular-nums">
                churn {h.churn} · cx {h.complexity} · <span className="text-[var(--text)]">risk {h.risk.toFixed(0)}</span>
              </div>
            </div>
            <div className="h-[5px] rounded-full bg-white/[0.04] overflow-hidden">
              <div className={`h-full rounded-full ${tone} opacity-80 group-hover:opacity-100 transition-opacity`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
