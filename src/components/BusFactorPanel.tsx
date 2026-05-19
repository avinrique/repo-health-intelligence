"use client";
import { useEffect, useState } from "react";

interface FileRow {
  path: string; factor: number; top_share: number; total_commits: number;
  top_author: string | null; top_author_commits: number;
}
interface ModuleRow {
  module: string; total_files: number; low_bus_files: number; module_factor: number;
  top_author: string | null; top_share: number; total_commits: number;
}

export default function BusFactorPanel({ sha }: { sha: string }) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  useEffect(() => {
    if (!sha) return;
    fetch(`/api/busfactor?sha=${sha}`).then((r) => r.json()).then((d) => {
      setFiles(d.files || []); setModules(d.modules || []);
    });
  }, [sha]);

  const risky = files.filter((f) => f.factor <= 1 && f.total_commits >= 3).slice(0, 12);
  const tlw = modules.slice(0, 8);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-3">Module ownership</div>
        <div className="space-y-2.5">
          {tlw.map((m) => {
            const tone = m.module_factor <= 1 ? "var(--bad)" : m.module_factor === 2 ? "var(--warn)" : "var(--good)";
            return (
              <div key={m.module}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="font-mono text-[12.5px] text-[var(--text)] truncate">{m.module}/</span>
                  <span className="text-[var(--text-muted)] whitespace-nowrap text-[11px]">
                    factor <span className="font-mono tabular-nums" style={{ color: tone }}>{m.module_factor}</span> · {m.total_files} files
                  </span>
                </div>
                <div className="h-[5px] rounded-full bg-white/[0.04] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, m.top_share * 100)}%`, background: tone, opacity: 0.7 }} />
                </div>
                <div className="text-[10.5px] text-[var(--text-faint)] mt-0.5">
                  top: <span className="text-[var(--text-muted)]">{m.top_author}</span> ({Math.round(m.top_share * 100)}%)
                </div>
              </div>
            );
          })}
          {!tlw.length && <div className="text-[var(--text-faint)]">(no module data)</div>}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-3">Single-owner files</div>
        <div className="space-y-1">
          {risky.map((f) => (
            <div key={f.path} className="flex items-baseline justify-between gap-3 py-1.5 px-2 rounded hover:bg-white/[0.025]">
              <span className="font-mono text-[12px] text-[var(--text)] truncate" title={f.path}>{f.path}</span>
              <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                <span className="text-[var(--text)]">{f.top_author?.split(" ")[0]}</span> {Math.round(f.top_share * 100)}% · {f.total_commits} commits
              </span>
            </div>
          ))}
          {!risky.length && <div className="text-[var(--text-faint)]">No files have bus factor ≤ 1.</div>}
        </div>
      </div>
    </div>
  );
}
