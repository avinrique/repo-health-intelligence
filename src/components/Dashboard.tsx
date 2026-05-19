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
import BrandMark from "./BrandMark";

type TabKey = "hotspots" | "busfactor" | "arch" | "predict" | "graph" | "diff";

interface ScoreRow {
  sha: string; idx: number; ts: number; author: string; message: string;
  health: number; complexity_drift: number; test_coverage: number; hotspot_risk: number; dependency_rot: number;
  arch_drift?: number; num_orphans?: number; num_cycles?: number; bus_factor_low?: number;
  total_files: number; total_loc: number; total_complexity: number;
}

interface Annotation { sha: string; idx: number; delta: number }
interface RepoInfo { url: string; branch: string; ingested_at: number }

const TABS: [TabKey, string, string][] = [
  ["hotspots", "Hotspots", "where bugs live"],
  ["busfactor", "Bus factor", "who owns what"],
  ["arch", "Architecture", "cycles · orphans · fan-in"],
  ["predict", "Predict", "simulate a branch merge"],
  ["graph", "Knowledge graph", "import topology"],
  ["diff", "Graph diff", "between any two commits"],
];

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
  const delta = latest && baseline ? latest.health - baseline.health : 0;

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
          <span className="w-2 h-2 rounded-full bg-[var(--primary)] health-pulse" />
          loading repo health …
        </div>
      </div>
    );
  }
  if (!series.length) {
    return (
      <div className="p-10 max-w-2xl">
        <h1 className="text-xl mb-2">No data yet</h1>
        <p className="text-[var(--text-muted)] text-sm">Run the ingestion script first:</p>
        <pre className="mt-3 card p-3 text-xs font-mono">npm run ingest -- https://github.com/tarinagarwal/Edulume</pre>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="px-6 lg:px-8 pt-6 pb-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <BrandMark size={28} />
            <div>
              <div className="text-[15px] font-medium tracking-tight">Repo Health Intelligence</div>
              {repo && (
                <div className="text-[11.5px] text-[var(--text-muted)] mt-0.5 flex items-center gap-2 flex-wrap">
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono hover:text-[var(--text)] underline-offset-2 hover:underline"
                  >
                    {repo.url.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
                  </a>
                  <span className="text-[var(--text-faint)]">·</span>
                  <span className="font-mono">{repo.branch}</span>
                  <span className="text-[var(--text-faint)]">·</span>
                  <span>{series.length} commits</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="kbd">live</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--good)] health-pulse" />
            <span className="text-[var(--text-muted)]">ingested {repo ? new Date(repo.ingested_at * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
          </div>
        </div>
      </header>

      {/* Hero KPIs */}
      <section className="px-6 lg:px-8 mb-6">
        <div className="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPI label="Health" value={latest?.health.toFixed(1) ?? "—"} sub="composite 0–100" colorVar="--primary" pulse />
          <KPI
            label="Δ vs first"
            value={`${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`}
            sub="net since baseline"
            colorVar={delta >= 0 ? "--good" : "--bad"}
          />
          <KPI label="Dips" value={String(annotations.length)} sub="health drops ≥ 3" colorVar="--warn" />
          <KPI label="Files" value={String(latest?.total_files ?? 0)} sub={`${(latest?.total_loc ?? 0).toLocaleString()} LOC`} />
          <KPI label="Risky owners" value={String(latest?.bus_factor_low ?? 0)} sub="bus factor ≤ 1" colorVar="--bad" />
        </div>
      </section>

      {/* Time-series + selected commit */}
      <section className="px-6 lg:px-8 mb-6">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <SectionHeader title="Health over time" hint={`${annotations.length} flagged · click any point to inspect`} />
            <HealthChart series={series} annotations={annotations} selectedSha={selected} onSelect={setSelected} />
            <SubscoreChart series={series} />
          </div>
          <div className="space-y-3">
            <SectionHeader title="Selected commit" />
            {selectedRow && <SelectedCommitCard row={selectedRow} prevSha={prevSha} />}
          </div>
        </div>
      </section>

      {/* Tabs + content */}
      <section className="px-6 lg:px-8 pb-12">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
            <div className="flex items-center gap-1 flex-wrap">
              {TABS.map(([k, label, hint]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`tab-pill ${tab === k ? "active" : ""}`}
                  title={hint}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
              <span>{TABS.find(([k]) => k === tab)?.[2]}</span>
              {tab === "diff" && <CompareSelector series={series} value={compareWith} onChange={setCompareWith} />}
            </div>
          </div>

          <div className="card p-5">
            {tab === "hotspots" && <Hotspots data={hotspots} />}
            {tab === "busfactor" && selected && <BusFactorPanel sha={selected} />}
            {tab === "arch" && selected && <ArchPanel sha={selected} />}
            {tab === "predict" && <PredictPanel />}
            {tab === "graph" && selected && <GraphView sha={selected} />}
            {tab === "diff" && compareWith && selected && <GraphDiff a={compareWith} b={selected} />}
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="text-xs font-medium tracking-wide uppercase text-[var(--text-muted)]">{title}</h2>
      {hint && <span className="text-[11px] text-[var(--text-faint)]">{hint}</span>}
    </div>
  );
}

function KPI({ label, value, sub, colorVar = "--text", pulse = false }: { label: string; value: string; sub?: string; colorVar?: string; pulse?: boolean }) {
  return (
    <div className="card card-hover p-4 relative overflow-hidden">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span
          className="text-2xl font-semibold tabular-nums tracking-tight"
          style={{ color: `var(${colorVar})` }}
        >
          {value}
        </span>
        {pulse && <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] health-pulse" />}
      </div>
      {sub && <div className="text-[11px] text-[var(--text-faint)] mt-1">{sub}</div>}
    </div>
  );
}

function SelectedCommitCard({ row, prevSha }: { row: ScoreRow; prevSha: string | null }) {
  const subs = [
    { label: "complexity drift", value: row.complexity_drift, invert: true, color: "#fbbf24" },
    { label: "test coverage",    value: row.test_coverage,    invert: false, color: "#34d399" },
    { label: "hotspot risk",     value: row.hotspot_risk,     invert: true, color: "#fb7185" },
    { label: "dependency rot",   value: row.dependency_rot,   invert: true, color: "#a78bfa" },
    { label: "arch drift",       value: row.arch_drift ?? 0,  invert: true, color: "#67e8f9" },
  ];
  return (
    <div className="card p-4 space-y-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-[var(--text-faint)]">{row.sha.slice(0, 7)}</div>
          <div className="mt-1 text-[var(--text)] line-clamp-2">{row.message.split("\n")[0]}</div>
          <div className="mt-1 text-[11px] text-[var(--text-muted)]">{row.author} · {new Date(row.ts * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Health</div>
          <div className="text-2xl font-semibold tabular-nums" style={{ color: "var(--primary)" }}>{row.health.toFixed(1)}</div>
        </div>
      </div>

      <div className="divider-glow" />

      <div className="space-y-2">
        {subs.map((s) => (
          <div key={s.label}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-[var(--text-muted)]">{s.label}</span>
              <span className="font-mono tabular-nums" style={{ color: s.color }}>{s.value.toFixed(3)}</span>
            </div>
            <div className="score-track mt-1">
              <div className="score-fill" style={{ width: `${Math.min(100, s.value * 100)}%`, background: s.color, opacity: 0.65 }} />
            </div>
          </div>
        ))}
      </div>

      <div className="divider-glow" />
      <ExplainPanel sha={row.sha} prev={prevSha} />
    </div>
  );
}

function CompareSelector({ series, value, onChange }: { series: ScoreRow[]; value: string | null; onChange: (s: string) => void }) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="text-[11px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] rounded-md px-2 py-1 text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
    >
      {series.map((s) => (
        <option key={s.sha} value={s.sha}>
          {s.idx} · {s.sha.slice(0, 7)} · {s.message.split("\n")[0].slice(0, 40)}
        </option>
      ))}
    </select>
  );
}
