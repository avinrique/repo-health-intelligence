"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceDot, Legend } from "recharts";
import { useMemo } from "react";

interface Point {
  sha: string;
  idx: number;
  ts: number;
  message: string;
  author: string;
  health: number;
  complexity_drift: number;
  test_coverage: number;
  hotspot_risk: number;
  dependency_rot: number;
}

interface Annotation {
  sha: string;
  idx: number;
  delta: number;
}

interface Props {
  series: Point[];
  annotations: Annotation[];
  selectedSha: string | null;
  onSelect: (sha: string) => void;
}

export default function HealthChart({ series, annotations, selectedSha, onSelect }: Props) {
  const data = useMemo(
    () =>
      series.map((p) => ({
        ...p,
        date: new Date(p.ts * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }),
      })),
    [series]
  );

  return (
    <div className="w-full h-[360px] bg-zinc-900/40 rounded-lg p-3 border border-zinc-800">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} onClick={(e: any) => e?.activePayload?.[0]?.payload?.sha && onSelect(e.activePayload[0].payload.sha)}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
          <XAxis dataKey="idx" stroke="#71717a" tick={{ fontSize: 11 }} />
          <YAxis stroke="#71717a" tick={{ fontSize: 11 }} domain={[0, 100]} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="health" stroke="#22c55e" strokeWidth={2} dot={false} name="Health" />
          <Line type="monotone" dataKey="test_coverage" stroke="#60a5fa" strokeWidth={1} dot={false} name="Test ratio" yAxisId={0} hide />
          {annotations.map((a) => {
            const pt = data.find((d) => d.sha === a.sha);
            if (!pt) return null;
            return (
              <ReferenceDot
                key={a.sha}
                x={pt.idx}
                y={pt.health}
                r={6}
                fill="#ef4444"
                stroke="#fff"
                strokeWidth={1}
                style={{ cursor: "pointer" }}
                onClick={() => onSelect(a.sha)}
              />
            );
          })}
          {selectedSha && (() => {
            const pt = data.find((d) => d.sha === selectedSha);
            if (!pt) return null;
            return <ReferenceDot x={pt.idx} y={pt.health} r={8} fill="none" stroke="#facc15" strokeWidth={2} />;
          })()}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-zinc-950 border border-zinc-700 rounded p-3 text-xs space-y-1 max-w-[300px]">
      <div className="font-mono text-zinc-400">{p.sha?.slice(0, 7)} · {p.date}</div>
      <div className="text-zinc-200 truncate">{p.message?.split("\n")[0]}</div>
      <div className="text-zinc-500">{p.author}</div>
      <div className="pt-1 border-t border-zinc-800 grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span>Health</span><span className="text-emerald-400 text-right">{p.health.toFixed(1)}</span>
        <span>Drift</span><span className="text-right">{p.complexity_drift}</span>
        <span>Tests</span><span className="text-right">{p.test_coverage}</span>
        <span>Hotspot</span><span className="text-right">{p.hotspot_risk}</span>
        <span>Rot</span><span className="text-right">{p.dependency_rot}</span>
      </div>
    </div>
  );
}
