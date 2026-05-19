"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceDot, ReferenceLine } from "recharts";
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
  arch_drift?: number;
}

interface Annotation { sha: string; idx: number; delta: number }

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
        date: new Date(p.ts * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      })),
    [series]
  );

  return (
    <div className="card p-4">
      <div className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 14, bottom: 4, left: -10 }}
            onClick={(e: any) => e?.activePayload?.[0]?.payload?.sha && onSelect(e.activePayload[0].payload.sha)}
          >
            <defs>
              <linearGradient id="health-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#67e8f9" />
              </linearGradient>
              <linearGradient id="health-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#23233a" strokeDasharray="2 6" vertical={false} />
            <XAxis dataKey="idx" tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={36} ticks={[0, 25, 50, 75, 100]} />
            <ReferenceLine y={75} stroke="#34d399" strokeOpacity={0.15} strokeDasharray="3 5" />
            <ReferenceLine y={50} stroke="#fbbf24" strokeOpacity={0.15} strokeDasharray="3 5" />
            <Tooltip cursor={{ stroke: "rgba(167,139,250,0.4)", strokeWidth: 1 }} content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="health"
              stroke="url(#health-stroke)"
              strokeWidth={2.25}
              fill="url(#health-fill)"
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4, fill: "#a78bfa", stroke: "#13131e", strokeWidth: 2 }}
            />
            {annotations.map((a) => {
              const pt = data.find((d) => d.sha === a.sha);
              if (!pt) return null;
              return (
                <ReferenceDot
                  key={a.sha}
                  x={pt.idx}
                  y={pt.health}
                  r={5}
                  fill="#fb7185"
                  stroke="#13131e"
                  strokeWidth={1.5}
                  style={{ cursor: "pointer" }}
                  onClick={() => onSelect(a.sha)}
                />
              );
            })}
            {selectedSha && (() => {
              const pt = data.find((d) => d.sha === selectedSha);
              if (!pt) return null;
              return <ReferenceDot x={pt.idx} y={pt.health} r={9} fill="none" stroke="#67e8f9" strokeOpacity={0.6} strokeWidth={1.5} />;
            })()}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-xs shadow-2xl max-w-[300px] space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[var(--text-muted)] text-[10px]">{p.sha?.slice(0, 7)}</span>
        <span className="text-[var(--text-faint)]">·</span>
        <span className="text-[var(--text-faint)] text-[10px]">{p.date}</span>
      </div>
      <div className="text-[var(--text)] line-clamp-2">{p.message?.split("\n")[0]}</div>
      <div className="text-[var(--text-faint)] text-[10px]">{p.author}</div>
      <div className="pt-1 mt-1 border-t border-[var(--border)] grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
        <span className="text-[var(--text-muted)]">Health</span>
        <span className="text-right font-mono" style={{ color: "#a78bfa" }}>{p.health.toFixed(1)}</span>
        <span className="text-[var(--text-muted)]">Drift</span><span className="text-right font-mono">{p.complexity_drift}</span>
        <span className="text-[var(--text-muted)]">Tests</span><span className="text-right font-mono">{p.test_coverage}</span>
        <span className="text-[var(--text-muted)]">Hotspot</span><span className="text-right font-mono">{p.hotspot_risk}</span>
        <span className="text-[var(--text-muted)]">Rot</span><span className="text-right font-mono">{p.dependency_rot}</span>
        {typeof p.arch_drift === "number" && (
          <>
            <span className="text-[var(--text-muted)]">Arch</span><span className="text-right font-mono">{p.arch_drift}</span>
          </>
        )}
      </div>
    </div>
  );
}
