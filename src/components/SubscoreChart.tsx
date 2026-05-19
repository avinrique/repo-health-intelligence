"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

interface Point {
  sha: string;
  idx: number;
  complexity_drift: number;
  test_coverage: number;
  hotspot_risk: number;
  dependency_rot: number;
  arch_drift?: number;
}

const LINES: { key: keyof Point; color: string; label: string }[] = [
  { key: "complexity_drift", color: "#fbbf24", label: "complexity drift" },
  { key: "test_coverage",    color: "#34d399", label: "test coverage" },
  { key: "hotspot_risk",     color: "#fb7185", label: "hotspot risk" },
  { key: "dependency_rot",   color: "#a78bfa", label: "dependency rot" },
  { key: "arch_drift",       color: "#67e8f9", label: "arch drift" },
];

export default function SubscoreChart({ series }: { series: Point[] }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase">Subscore drift</h3>
        <span className="text-[10px] text-[var(--text-faint)]">all five normalized to 0–1</span>
      </div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid stroke="#23233a" strokeDasharray="2 6" vertical={false} />
            <XAxis dataKey="idx" tickLine={false} axisLine={false} />
            <YAxis domain={[0, 1]} tickLine={false} axisLine={false} width={36} ticks={[0, 0.5, 1]} />
            <Tooltip
              cursor={{ stroke: "rgba(167,139,250,0.3)", strokeWidth: 1 }}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "var(--text-muted)" }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "var(--text-muted)", paddingTop: 6 }}
              iconType="plainline"
              iconSize={14}
            />
            {LINES.map((l) => (
              <Line key={l.key} dataKey={l.key} stroke={l.color} strokeWidth={1.5} dot={false} name={l.label} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
