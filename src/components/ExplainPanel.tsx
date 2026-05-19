"use client";
import { useEffect, useState } from "react";

interface Props { sha: string; prev: string | null }

export default function ExplainPanel({ sha, prev }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ cached?: boolean; model?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => { setText(null); setMeta(null); setRequested(false); }, [sha, prev]);

  const ask = async () => {
    if (!prev) return;
    setLoading(true); setRequested(true);
    try {
      const r = await fetch("/api/explain", { method: "POST", body: JSON.stringify({ sha, prev }), headers: { "content-type": "application/json" } });
      const j = await r.json();
      setText(j.text || j.error || "(no response)");
      setMeta({ cached: j.cached, model: j.model });
    } finally { setLoading(false); }
  };

  if (!prev) return <div className="text-[var(--text-faint)] text-xs">First commit — no prior to compare.</div>;

  return (
    <div className="space-y-2">
      {!requested ? (
        <button
          onClick={ask}
          className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-[var(--text)]
                     bg-gradient-to-r from-[rgba(167,139,250,0.18)] to-[rgba(103,232,249,0.10)]
                     border border-[rgba(167,139,250,0.35)]
                     hover:from-[rgba(167,139,250,0.28)] hover:to-[rgba(103,232,249,0.16)]
                     transition-all flex items-center justify-between"
        >
          <span>Explain why health changed</span>
          <span className="text-[var(--text-faint)] text-[10px]">→</span>
        </button>
      ) : loading ? (
        <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] health-pulse" />
          analyzing deltas …
        </div>
      ) : (
        <>
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
            <span>narrative</span>
            <span className="text-[var(--text-faint)]">·</span>
            <span className="text-[var(--text-faint)]">{meta?.cached ? "cached" : "fresh"} · {meta?.model}</span>
          </div>
          <p className="text-[13px] text-[var(--text)] leading-relaxed font-mono">{text}</p>
        </>
      )}
    </div>
  );
}
