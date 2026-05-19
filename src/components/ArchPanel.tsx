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
    <div className="space-y-4">
      <div className="h-[200px] bg-zinc-900/40 rounded-lg p-3 border border-zinc-800">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series}>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis dataKey="idx" stroke="#71717a" tick={{ fontSize: 11 }} />
            <YAxis stroke="#71717a" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#0a0a0c", border: "1px solid #3f3f46", borderRadius: 6, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line dataKey="num_cycles" stroke="#f97316" dot={false} name="cycles" />
            <Line dataKey="num_orphans" stroke="#a78bfa" dot={false} name="orphans" />
            <Line dataKey="bus_factor_low" stroke="#ef4444" dot={false} name="bus-factor ≤1 files" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <div className="text-zinc-300 mb-2 font-medium">Cycles at this commit ({cycles.length})</div>
          <div className="space-y-1 max-h-56 overflow-auto pr-2">
            {cycles.slice(0, 20).map((c) => (
              <div key={c.id} className="border border-zinc-800 rounded p-1.5 bg-zinc-900/40">
                <div className="text-zinc-400 mb-0.5">cycle #{c.id} · {c.size} files</div>
                <div className="space-y-0 font-mono text-zinc-200">
                  {c.members.slice(0, 6).map((m) => <div key={m} className="truncate">{m}</div>)}
                  {c.members.length > 6 && <div className="text-zinc-600">+{c.members.length - 6} more</div>}
                </div>
              </div>
            ))}
            {!cycles.length && <div className="text-zinc-600">No cycles detected.</div>}
          </div>
        </div>
        <div>
          <div className="text-zinc-300 mb-2 font-medium">Orphan files ({orphans.length}) <span className="text-zinc-500 font-normal">— no in/out internal imports</span></div>
          <div className="space-y-0 font-mono max-h-56 overflow-auto pr-2">
            {orphans.slice(0, 30).map((o) => (
              <div key={o.path} className="text-zinc-300 truncate">{o.path}</div>
            ))}
            {orphans.length > 30 && <div className="text-zinc-600">+{orphans.length - 30} more</div>}
            {!orphans.length && <div className="text-zinc-600">None.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
