"use client";
import { useEffect, useMemo, useState } from "react";
import HealthChart from "./HealthChart";
import SubscoreChart from "./SubscoreChart";
import Hotspots from "./Hotspots";
import GraphDiff from "./GraphDiff";
import ExplainPanel from "./ExplainPanel";
import BusFactorPanel from "./BusFactorPanel";
import ArchPanel from "./ArchPanel";
import PredictPanel from "./PredictPanel";
import GraphView from "./GraphView";

type TabKey = "hotspots" | "busfactor" | "arch" | "predict" | "graph" | "diff";

interface ScoreRow {
  sha: string; idx: number; ts: number; author: string; message: string;
  health: number; complexity_drift: number; test_coverage: number; hotspot_risk: number; dependency_rot: number;
  arch_drift?: number; num_orphans?: number; num_cycles?: number; bus_factor_low?: number;
  total_files: number; total_loc: number; total_complexity: number;
}

interface Annotation { sha: string; idx: number; delta: number }

interface RepoInfo { url: string; branch: string; ingested_at: number }

export default function Dashboard() {
  const [series, setSeries] = useState<ScoreRow[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [hotspots, setHotspots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("hotspots");

  useEffect(() => {
    (async () => {
      const [scoresRes, commitsRes] = await Promise.all([
        fetch("/api/scores").then((r) => r.json()),
        fetch("/api/commits").then((r) => r.json()),
      ]);
      setSeries(scoresRes.series);
      setAnnotations(scoresRes.annotations);
      setRepo(commitsRes.repo);
      const last = scoresRes.series[scoresRes.series.length - 1];
      const first = scoresRes.series[0];
      if (last) setSelected(last.sha);
      if (first) setCompareWith(first.sha);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/hotspots?sha=${selected}`).then((r) => r.json()).then((d) => setHotspots(d.hotspots || []));
  }, [selected]);

  const selectedRow = useMemo(() => series.find((s) => s.sha === selected) || null, [series, selected]);
  const prevSha = useMemo(() => {
    if (!selectedRow) return null;
    const i = series.findIndex((s) => s.sha === selectedRow.sha);
    return i > 0 ? series[i - 1].sha : null;
  }, [series, selectedRow]);

  const latest = series[series.length - 1];
  const baseline = series[0];

  if (loading) {
    return <div className="p-6 text-zinc-400">Loading…</div>;
  }
  if (!series.length) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-xl mb-2">No data yet</h1>
        <p className="text-zinc-400 text-sm">Run the ingestion script first:</p>
        <pre className="mt-2 bg-zinc-900 p-3 rounded text-xs overflow-x-auto">npm run ingest -- https://github.com/tarinagarwal/Edulume</pre>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Repo Health Intelligence</h1>
          {repo && (
            <div className="text-xs text-zinc-500 mt-0.5">
              <a href={repo.url} target="_blank" className="hover:text-zinc-300 underline-offset-2 hover:underline">{repo.url}</a>
              {" · "}{repo.branch} · {series.length} commits ingested
            </div>
          )}
        </div>
        {latest && baseline && (
          <div className="flex gap-3 text-xs">
            <KPI label="Latest health" value={latest.health.toFixed(1)} accent="text-emerald-400" />
            <KPI label="Δ vs first" value={`${(latest.health - baseline.health).toFixed(1)}`} accent={latest.health >= baseline.health ? "text-emerald-400" : "text-red-400"} />
            <KPI label="Files" value={String(latest.total_files)} />
            <KPI label="LOC" value={latest.total_loc.toLocaleString()} />
          </div>
        )}
      </header>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-zinc-300">Health over time</h2>
          <div className="text-[11px] text-zinc-500">
            {annotations.length} dip{annotations.length === 1 ? "" : "s"} (red dots) · click any point
          </div>
        </div>
        <HealthChart series={series} annotations={annotations} selectedSha={selected} onSelect={setSelected} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">Subscores</h2>
          <SubscoreChart series={series} />
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">Selected commit</h2>
          {selectedRow && (
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3 text-xs space-y-2">
              <div className="font-mono text-zinc-400">{selectedRow.sha.slice(0, 7)}</div>
              <div className="text-zinc-200">{selectedRow.message.split("\n")[0]}</div>
              <div className="text-zinc-500">{selectedRow.author} · {new Date(selectedRow.ts * 1000).toLocaleString()}</div>
              <div className="pt-2 border-t border-zinc-800 grid grid-cols-2 gap-x-2 gap-y-0.5">
                <Stat label="Health" value={selectedRow.health.toFixed(1)} />
                <Stat label="Files" value={String(selectedRow.total_files)} />
                <Stat label="Drift" value={String(selectedRow.complexity_drift)} />
                <Stat label="Tests" value={String(selectedRow.test_coverage)} />
                <Stat label="Hotspot" value={String(selectedRow.hotspot_risk)} />
                <Stat label="Rot" value={String(selectedRow.dependency_rot)} />
              </div>
              <div className="pt-2 border-t border-zinc-800">
                <ExplainPanel sha={selectedRow.sha} prev={prevSha} />
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-1 border-b border-zinc-800 mb-3">
          {([
            ["hotspots", "Hotspots"],
            ["busfactor", "Bus factor"],
            ["arch", "Architecture"],
            ["predict", "Predict PR"],
            ["graph", "Knowledge graph"],
            ["diff", "Graph diff"],
          ] as [TabKey, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3 py-1.5 text-xs border-b-2 -mb-px ${tab === k ? "border-emerald-400 text-emerald-300" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}
            >
              {label}
            </button>
          ))}
          {tab === "diff" && (
            <div className="ml-auto">
              <CompareSelector series={series} value={compareWith} onChange={setCompareWith} />
            </div>
          )}
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-4">
          {tab === "hotspots" && <Hotspots data={hotspots} />}
          {tab === "busfactor" && selected && <BusFactorPanel sha={selected} />}
          {tab === "arch" && selected && <ArchPanel sha={selected} />}
          {tab === "predict" && <PredictPanel />}
          {tab === "graph" && selected && <GraphView sha={selected} />}
          {tab === "diff" && compareWith && selected && <GraphDiff a={compareWith} b={selected} />}
        </div>
      </section>
    </div>
  );
}

function KPI({ label, value, accent = "" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded px-3 py-1.5">
      <div className={`text-base font-semibold ${accent}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-zinc-500">{label}</span>
      <span className="text-right text-zinc-200">{value}</span>
    </>
  );
}

function CompareSelector({ series, value, onChange }: { series: ScoreRow[]; value: string | null; onChange: (s: string) => void }) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="text-[11px] bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300"
    >
      {series.map((s) => (
        <option key={s.sha} value={s.sha}>
          {s.idx} · {s.sha.slice(0, 7)} · {s.message.split("\n")[0].slice(0, 40)}
        </option>
      ))}
    </select>
  );
}
