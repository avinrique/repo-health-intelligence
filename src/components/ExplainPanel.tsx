"use client";
import { useEffect, useState } from "react";

interface Props {
  sha: string;
  prev: string | null;
}

export default function ExplainPanel({ sha, prev }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ cached?: boolean; model?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    setText(null); setMeta(null); setRequested(false);
  }, [sha, prev]);

  const ask = async () => {
    if (!prev) return;
    setLoading(true); setRequested(true);
    try {
      const r = await fetch("/api/explain", { method: "POST", body: JSON.stringify({ sha, prev }), headers: { "content-type": "application/json" } });
      const j = await r.json();
      setText(j.text || j.error || "(no response)");
      setMeta({ cached: j.cached, model: j.model });
    } finally {
      setLoading(false);
    }
  };

  if (!prev) return <div className="text-zinc-500 text-sm">First commit — no prior to compare.</div>;
  return (
    <div className="text-sm space-y-2">
      {!requested ? (
        <button
          onClick={ask}
          className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded text-amber-200 text-xs"
        >
          Explain why health changed
        </button>
      ) : loading ? (
        <div className="text-zinc-500 text-xs">Thinking…</div>
      ) : (
        <>
          <p className="text-zinc-200 leading-relaxed">{text}</p>
          <div className="text-[10px] text-zinc-500">
            {meta?.cached ? "cached" : "fresh"} · model {meta?.model}
          </div>
        </>
      )}
    </div>
  );
}
