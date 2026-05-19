"use client";
import { useEffect, useState } from "react";

interface FileRow {
  path: string;
  factor: number;
  top_share: number;
  total_commits: number;
  top_author: string | null;
  top_author_commits: number;
}
interface ModuleRow {
  module: string;
  total_files: number;
  low_bus_files: number;
  module_factor: number;
  top_author: string | null;
  top_share: number;
  total_commits: number;
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

  const risky = files.filter((f) => f.factor <= 1 && f.total_commits >= 3).slice(0, 15);
  const tlw = modules.slice(0, 8);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
      <div>
        <div className="text-zinc-300 mb-2 font-medium">Module bus factor</div>
        <div className="space-y-1.5">
          {tlw.map((m) => {
            const color = m.module_factor <= 1 ? "bg-red-500/70" : m.module_factor === 2 ? "bg-amber-500/70" : "bg-emerald-500/70";
            return (
              <div key={m.module}>
                <div className="flex justify-between gap-2 mb-0.5">
                  <span className="font-mono text-zinc-300 truncate">{m.module}/</span>
                  <span className="text-zinc-500 whitespace-nowrap">factor {m.module_factor} · {m.total_files} files · {m.top_author?.split(" ")[0]} {Math.round(m.top_share * 100)}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded overflow-hidden">
                  <div className={`h-full ${color}`} style={{ width: `${Math.min(100, m.top_share * 100)}%` }} />
                </div>
              </div>
            );
          })}
          {!tlw.length && <div className="text-zinc-600">(no module data)</div>}
        </div>
      </div>
      <div>
        <div className="text-zinc-300 mb-2 font-medium">Top risky single-owner files</div>
        <div className="space-y-0.5">
          {risky.map((f) => (
            <div key={f.path} className="flex justify-between gap-2">
              <span className="font-mono text-zinc-200 truncate" title={f.path}>{f.path}</span>
              <span className="text-zinc-500 whitespace-nowrap">{f.top_author?.split(" ")[0]} {Math.round(f.top_share * 100)}% · {f.total_commits} commits</span>
            </div>
          ))}
          {!risky.length && <div className="text-zinc-600">(no files have bus factor ≤ 1)</div>}
        </div>
      </div>
    </div>
  );
}
