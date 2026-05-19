"use client";
import { useEffect, useState } from "react";

interface Prediction {
  branch: string;
  base: { sha: string; health: number } & Record<string, number>;
  predicted: { health: number } & Record<string, number>;
  delta: number;
  summary: { files: number; loc: number; complexity: number; cycles: number; orphans: number; newFiles: string[] };
}

export default function PredictPanel() {
  const [branches, setBranches] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [pick, setPick] = useState<string>("");
  const [pred, setPred] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/branches`).then((r) => r.json()).then((d) => {
      setBranches(d.branches || []);
      setCurrent(d.current || null);
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
      if (j.error) setError(j.error);
      else setPred(j);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-zinc-400">Predict health if merged from</span>
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
        >
          <option value="" disabled>choose branch…</option>
          {branches.filter((b) => b !== current).map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <span className="text-zinc-500">into <span className="font-mono text-zinc-300">{current}</span></span>
        <button
          onClick={run}
          disabled={!pick || loading}
          className="ml-2 px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded text-emerald-200 disabled:opacity-40"
        >
          {loading ? "Simulating…" : "Simulate"}
        </button>
      </div>
      {error && <div className="text-red-400">{error}</div>}
      {pred && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Bar label="Current health" value={pred.base.health.toFixed(1)} accent="text-zinc-200" />
            <Bar label={`Predicted (${pred.branch})`} value={pred.predicted.health.toFixed(1)} accent={pred.delta >= 0 ? "text-emerald-300" : "text-red-300"} />
            <Bar label="Δ" value={`${pred.delta >= 0 ? "+" : ""}${pred.delta.toFixed(1)}`} accent={pred.delta >= 0 ? "text-emerald-400" : "text-red-400"} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {(["complexity_drift","test_coverage","hotspot_risk","dependency_rot","arch_drift"] as const).map((k) => (
              <SubBar key={k} label={k.replace("_"," ")} before={pred.base[k]} after={pred.predicted[k]} invert={k !== "test_coverage"} />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
            <Mini label="files" value={pred.summary.files} />
            <Mini label="LOC" value={pred.summary.loc.toLocaleString()} />
            <Mini label="cycles" value={pred.summary.cycles} />
            <Mini label="orphans" value={pred.summary.orphans} />
          </div>
          {pred.summary.newFiles.length > 0 && (
            <div>
              <div className="text-zinc-400 mb-1">New files in branch (first 10)</div>
              <div className="space-y-0 font-mono">
                {pred.summary.newFiles.map((f) => <div key={f} className="text-emerald-300 truncate">+ {f}</div>)}
              </div>
            </div>
          )}
        </div>
      )}
      {!pred && !loading && !error && (
        <div className="text-zinc-500">Pick a branch and click Simulate. The system parses the branch HEAD, recomputes all five subscores against the current churn/baseline, and reports the predicted health delta.</div>
      )}
    </div>
  );
}

function Bar({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded p-2">
      <div className={`text-lg font-semibold ${accent}`}>{value}</div>
      <div className="text-zinc-500 text-[10px] uppercase tracking-wide">{label}</div>
    </div>
  );
}

function SubBar({ label, before, after, invert }: { label: string; before: number; after: number; invert: boolean }) {
  const delta = after - before;
  const worse = invert ? delta > 0 : delta < 0;
  const color = Math.abs(delta) < 0.005 ? "text-zinc-400" : worse ? "text-red-400" : "text-emerald-400";
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded p-2">
      <div className="text-zinc-500 text-[10px] uppercase tracking-wide">{label}</div>
      <div className={`text-sm ${color}`}>{before.toFixed(3)} → {after.toFixed(3)}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded px-2 py-1 flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200 font-mono">{value}</span>
    </div>
  );
}
