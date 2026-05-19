"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

interface Point {
  sha: string;
  idx: number;
  complexity_drift: number;
  test_coverage: number;
  hotspot_risk: number;
  dependency_rot: number;
}

export default function SubscoreChart({ series }: { series: Point[] }) {
  return (
    <div className="w-full h-[260px] bg-zinc-900/40 rounded-lg p-3 border border-zinc-800">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
          <XAxis dataKey="idx" stroke="#71717a" tick={{ fontSize: 11 }} />
          <YAxis stroke="#71717a" tick={{ fontSize: 11 }} domain={[0, 1]} />
          <Tooltip
            contentStyle={{ background: "#0a0a0c", border: "1px solid #3f3f46", borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: "#a1a1aa" }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line dataKey="complexity_drift" stroke="#f97316" dot={false} name="complexity drift" />
          <Line dataKey="test_coverage"    stroke="#60a5fa" dot={false} name="test coverage" />
          <Line dataKey="hotspot_risk"     stroke="#ef4444" dot={false} name="hotspot risk" />
          <Line dataKey="dependency_rot"   stroke="#a78bfa" dot={false} name="dependency rot" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
