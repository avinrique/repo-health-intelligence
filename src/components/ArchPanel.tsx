"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

interface ArchPoint {
  sha: string; idx: number; arch_drift: number;
  num_orphans: number; num_cycles: number;
  mean_fan_in: number; mean_fan_out: number; bus_factor_low: number;
}
interface Cycle { id: number; size: number; members: string[] }

export default function ArchPanel({ sha }: { sha: string }) {
  const [series, setSeries] = useState<ArchPoint[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [orphans, setOrphans] = useState<{ path: string }[]>([]);

  useEffect(() => {
    fetch(`/api/arch`).then((r) => r.json()).then((d) => setSeries(d.series || []));
  }, []);
  useEffect(() => {
    if (!sha) return;
    fetch(`/api/cycles?sha=${sha}`).then((r) => r.json()).then((d) => {
      setCycles(d.cycles || []); setOrphans(d.orphans || []);
    });
  }, [sha]);

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">Topology over time</div>
        <div className="h-[210px] -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid stroke="#23233a" strokeDasharray="2 6" vertical={false} />
              <XAxis dataKey="idx" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={36} />
              <Tooltip
                cursor={{ stroke: "rgba(167,139,250,0.3)", strokeWidth: 1 }}
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: "var(--text-muted)" }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)", paddingTop: 4 }} iconType="plainline" />
              <Line dataKey="num_cycles" stroke="#fbbf24" strokeWidth={1.5} dot={false} name="cycles" isAnimationActive={false} />
              <Line dataKey="num_orphans" stroke="#67e8f9" strokeWidth={1.5} dot={false} name="orphans" isAnimationActive={false} />
              <Line dataKey="bus_factor_low" stroke="#fb7185" strokeWidth={1.5} dot={false} name="bus-factor ≤ 1 files" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Cycles at this commit</span>
            <span className="text-[10px] text-[var(--text-faint)]">{cycles.length} total</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-auto pr-1">
            {cycles.slice(0, 20).map((c) => (
              <div key={c.id} className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-2.5">
                <div className="text-[10.5px] text-[var(--text-muted)] mb-1 flex justify-between">
                  <span>cycle #{c.id}</span>
                  <span>{c.size} files</span>
                </div>
                <div className="font-mono space-y-0.5">
                  {c.members.slice(0, 6).map((m) => <div key={m} className="text-[12px] text-[var(--text)] truncate">↻ {m}</div>)}
                  {c.members.length > 6 && <div className="text-[var(--text-faint)]">+{c.members.length - 6} more</div>}
                </div>
              </div>
            ))}
            {!cycles.length && <div className="text-[var(--text-faint)]">No cycles detected.</div>}
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Orphan files</span>
            <span className="text-[10px] text-[var(--text-faint)]">no in/out internal imports · {orphans.length} total</span>
          </div>
          <div className="font-mono space-y-0.5 max-h-64 overflow-auto pr-1">
            {orphans.slice(0, 40).map((o) => (
              <div key={o.path} className="text-[12px] text-[var(--text)] truncate py-0.5 px-1 rounded hover:bg-white/[0.025]">{o.path}</div>
            ))}
            {orphans.length > 40 && <div className="text-[var(--text-faint)]">+{orphans.length - 40} more</div>}
            {!orphans.length && <div className="text-[var(--text-faint)]">None.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
