"use client";
import { useEffect, useState } from "react";

interface Prediction {
  branch: string;
  base: { sha: string; health: number } & Record<string, number>;
  predicted: { health: number } & Record<string, number>;
  delta: number;
  summary: { files: number; loc: number; complexity: number; cycles: number; orphans: number; newFiles: string[] };
}

const SUBS: [string, string, boolean][] = [
  ["complexity_drift", "complexity drift", true],
  ["test_coverage", "test coverage", false],
  ["hotspot_risk", "hotspot risk", true],
  ["dependency_rot", "dependency rot", true],
  ["arch_drift", "arch drift", true],
];

export default function PredictPanel() {
  const [branches, setBranches] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [pick, setPick] = useState<string>("");
  const [pred, setPred] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/branches`).then((r) => r.json()).then((d) => {
      setBranches(d.branches || []); setCurrent(d.current || null);
      const first = (d.branches || []).find((b: string) => b !== d.current) || "";
      setPick(first);
    });
  }, []);

  const run = async () => {
    if (!pick) return;
    setLoading(true); setError(null); setPred(null);
    try {
      const r = await fetch(`/api/predict?branch=${encodeURIComponent(pick)}`);
      const j = await r.json();
      if (j.error) setError(j.error); else setPred(j);
    } catch (e: any) { setError(String(e)); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[var(--text-muted)]">Merge</span>
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          className="bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] rounded-md px-2.5 py-1.5 text-[var(--text)] font-mono text-[12px] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
        >
          <option value="" disabled>choose branch…</option>
          {branches.filter((b) => b !== current).map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <span className="text-[var(--text-muted)]">into</span>
        <span className="font-mono text-[var(--text)] px-2 py-1 rounded bg-[var(--surface-2)] border border-[var(--border)]">{current}</span>
        <button
          onClick={run}
          disabled={!pick || loading}
          className="ml-auto px-4 py-1.5 rounded-md text-[12px] font-medium text-[var(--text)]
                     bg-gradient-to-r from-[rgba(167,139,250,0.25)] to-[rgba(103,232,249,0.15)]
                     border border-[rgba(167,139,250,0.4)]
                     hover:from-[rgba(167,139,250,0.35)] hover:to-[rgba(103,232,249,0.22)]
                     disabled:opacity-40 transition-all"
        >
          {loading ? "Simulating…" : "Simulate merge"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-[var(--bad)]/30 bg-[var(--bad)]/5 px-3 py-2 text-[var(--bad)]">{error}</div>
      )}

      {pred && (
        <div className="space-y-4">
          {/* Hero comparison */}
          <div className="grid grid-cols-3 gap-3">
            <BigStat label="Current health" value={pred.base.health.toFixed(1)} color="var(--text-muted)" />
            <BigStat label={`Predicted (${pred.branch})`} value={pred.predicted.health.toFixed(1)} color={pred.delta >= 0 ? "var(--good)" : "var(--warn)"} />
            <BigStat label="Δ if merged" value={`${pred.delta >= 0 ? "+" : ""}${pred.delta.toFixed(1)}`} color={pred.delta >= 0 ? "var(--good)" : "var(--bad)"} highlight />
          </div>

          {/* Subscore impact */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-3">Subscore impact</div>
            <div className="space-y-2.5">
              {SUBS.map(([k, label, invert]) => {
                const before = pred.base[k] as number;
                const after = pred.predicted[k] as number;
                const d = after - before;
                const worse = invert ? d > 0 : d < 0;
                const c = Math.abs(d) < 0.005 ? "var(--text-muted)" : worse ? "var(--bad)" : "var(--good)";
                return (
                  <div key={k} className="grid grid-cols-12 items-center gap-3">
                    <div className="col-span-3 text-[var(--text-muted)]">{label}</div>
                    <div className="col-span-7 flex items-center gap-2">
                      <div className="font-mono tabular-nums text-[11px] text-[var(--text-muted)] w-12 text-right">{before.toFixed(3)}</div>
                      <div className="flex-1 score-track">
                        <div className="score-fill" style={{ width: `${Math.min(100, before * 100)}%`, background: "var(--text-muted)", opacity: 0.4 }} />
                        <div className="score-fill" style={{ width: `${Math.min(100, after * 100)}%`, background: c, opacity: 0.85 }} />
                      </div>
                      <div className="font-mono tabular-nums text-[11px] w-12" style={{ color: c }}>{after.toFixed(3)}</div>
                    </div>
                    <div className="col-span-2 text-[10.5px] text-right" style={{ color: c }}>
                      {Math.abs(d) < 0.005 ? "no change" : worse ? "worse" : "better"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Mini label="files" value={pred.summary.files} />
            <Mini label="LOC" value={pred.summary.loc.toLocaleString()} />
            <Mini label="cycles" value={pred.summary.cycles} />
            <Mini label="orphans" value={pred.summary.orphans} />
          </div>

          {pred.summary.newFiles.length > 0 && (
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">New files in branch</div>
              <div className="font-mono space-y-0.5">
                {pred.summary.newFiles.map((f) => <div key={f} className="text-[12px] text-[var(--good)] truncate">+ {f}</div>)}
              </div>
            </div>
          )}
        </div>
      )}

      {!pred && !loading && !error && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--text-muted)]">
          Choose a branch and click <span className="kbd">Simulate merge</span>. The system parses the branch HEAD, recomputes all five subscores against current churn + baseline, and reports predicted Δhealth.
        </div>
      )}
    </div>
  );
}

function BigStat({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border ${highlight ? "border-[var(--primary)]/40" : "border-[var(--border)]"} bg-[var(--surface)] p-3.5`}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="text-3xl font-semibold tabular-nums mt-1" style={{ color }}>{value}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 flex items-baseline justify-between">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="text-[var(--text)] font-mono tabular-nums">{value}</span>
    </div>
  );
}
