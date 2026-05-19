"use client";
import { useEffect, useMemo, useRef, useState } from "react";

interface Node { id: string; path: string; loc: number; complexity: number }
interface Edge { src: string; dst: string }

export default function GraphView({ sha }: { sha: string }) {
  const [data, setData] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<Node | null>(null);

  useEffect(() => {
    if (!sha) return;
    fetch(`/api/graph?sha=${sha}`).then((r) => r.json()).then((d) => setData({ nodes: d.nodes, edges: d.edges }));
  }, [sha]);

  const layout = useMemo(() => {
    if (!data) return null;
    return runForceLayout(data.nodes, data.edges, 720, 460);
  }, [data]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !layout) return;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = "#0a0a0c"; ctx.fillRect(0, 0, w, h);
    // edges
    ctx.strokeStyle = "rgba(115,115,135,0.35)"; ctx.lineWidth = 1;
    for (const e of layout.edges) {
      ctx.beginPath();
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.b.x, e.b.y);
      ctx.stroke();
    }
    // nodes
    for (const n of layout.nodes) {
      const r = 2 + Math.min(8, Math.sqrt(Math.max(1, n.node.complexity)) * 0.8);
      const hot = n.node.complexity > 60 ? "#ef4444" : n.node.complexity > 25 ? "#f59e0b" : "#22c55e";
      ctx.fillStyle = hot;
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }, [layout]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!layout) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) * (720 / rect.width);
    const y = (e.clientY - rect.top) * (460 / rect.height);
    let best: any = null, bestD = 9999;
    for (const n of layout.nodes) {
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < bestD) { bestD = d; best = n; }
    }
    if (best && bestD < 100) setHover(best.node);
    else setHover(null);
  };

  return (
    <div className="space-y-2">
      <div className="text-zinc-500 text-xs">
        {data ? `${data.nodes.length} nodes · ${data.edges.length} edges (file-level import graph)` : "Loading graph…"}
      </div>
      <div className="relative bg-zinc-900/40 border border-zinc-800 rounded-lg overflow-hidden">
        <canvas
          ref={ref}
          width={720}
          height={460}
          className="w-full h-auto"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
        {hover && (
          <div className="absolute top-2 left-2 bg-zinc-950/95 border border-zinc-700 rounded px-2 py-1 text-xs font-mono pointer-events-none max-w-[60%]">
            <div className="text-zinc-200 truncate">{hover.path}</div>
            <div className="text-zinc-500">loc {hover.loc} · cx {hover.complexity}</div>
          </div>
        )}
      </div>
      <div className="text-[11px] text-zinc-500">Node size ∝ √complexity. Color: green ≤25, amber 26-60, red &gt;60.</div>
    </div>
  );
}

interface LaidOut { nodes: { node: Node; x: number; y: number }[]; edges: { a: { x: number; y: number }; b: { x: number; y: number } }[] }

function runForceLayout(nodes: Node[], edges: Edge[], W: number, H: number): LaidOut {
  const N = nodes.length;
  const idx = new Map<string, number>();
  nodes.forEach((n, i) => idx.set(n.id, i));
  const x = new Float32Array(N), y = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
  // seed: spiral
  for (let i = 0; i < N; i++) {
    const a = i * 2.4;
    const r = 8 + 8 * Math.sqrt(i);
    x[i] = W / 2 + r * Math.cos(a);
    y[i] = H / 2 + r * Math.sin(a);
  }
  const adjEdges = edges.map((e) => [idx.get(e.src)!, idx.get(e.dst)!] as [number, number]).filter(([a, b]) => a != null && b != null && a !== b);
  const ITERS = 220;
  const REPEL = 800;
  const SPRING = 0.02;
  const SPRING_LEN = 30;
  const CENTER = 0.005;
  const DAMP = 0.85;
  for (let it = 0; it < ITERS; it++) {
    // repulsive (O(N^2) — fine for ~few hundred nodes)
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        let dx = x[i] - x[j], dy = y[i] - y[j];
        let d2 = dx * dx + dy * dy + 0.01;
        const f = REPEL / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        vx[i] += fx; vy[i] += fy;
        vx[j] -= fx; vy[j] -= fy;
      }
    }
    // attractive (springs)
    for (const [a, b] of adjEdges) {
      const dx = x[b] - x[a], dy = y[b] - y[a];
      const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const f = (d - SPRING_LEN) * SPRING;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      vx[a] += fx; vy[a] += fy;
      vx[b] -= fx; vy[b] -= fy;
    }
    // center pull
    for (let i = 0; i < N; i++) {
      vx[i] += (W / 2 - x[i]) * CENTER;
      vy[i] += (H / 2 - y[i]) * CENTER;
      vx[i] *= DAMP; vy[i] *= DAMP;
      x[i] += vx[i]; y[i] += vy[i];
      if (x[i] < 6) x[i] = 6; if (x[i] > W - 6) x[i] = W - 6;
      if (y[i] < 6) y[i] = 6; if (y[i] > H - 6) y[i] = H - 6;
    }
  }
  const outNodes = nodes.map((n, i) => ({ node: n, x: x[i], y: y[i] }));
  const outEdges = adjEdges.map(([a, b]) => ({ a: { x: x[a], y: y[a] }, b: { x: x[b], y: y[b] } }));
  return { nodes: outNodes, edges: outEdges };
}
