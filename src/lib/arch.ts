/**
 * Architectural drift signals: SCCs / cycles, orphans, fan-in / fan-out.
 *
 * Inputs are the per-commit import graph (file -> file edges).
 */
export interface ArchInputs {
  paths: string[];              // all source-file paths at this commit
  edges: { src: string; dst: string }[]; // import edges between paths
}

export interface ArchMetrics {
  numNodes: number;
  numEdges: number;
  orphans: string[];           // files with no in-edges AND no out-edges
  cycles: string[][];          // strongly connected components with size >= 2
  meanFanIn: number;
  meanFanOut: number;
  maxFanIn: number;
  fanIn: Map<string, number>;
  fanOut: Map<string, number>;
}

export function computeArch(inp: ArchInputs): ArchMetrics {
  const idx = new Map<string, number>();
  inp.paths.forEach((p, i) => idx.set(p, i));

  const out: number[][] = inp.paths.map(() => []);
  const inDeg: number[] = inp.paths.map(() => 0);
  const outDeg: number[] = inp.paths.map(() => 0);

  for (const e of inp.edges) {
    const a = idx.get(e.src), b = idx.get(e.dst);
    if (a == null || b == null || a === b) continue;
    out[a].push(b);
    outDeg[a]++;
    inDeg[b]++;
  }

  // orphans: zero in and zero out (purely disconnected from internal graph)
  const orphans: string[] = [];
  for (let i = 0; i < inp.paths.length; i++) {
    if (inDeg[i] === 0 && outDeg[i] === 0) orphans.push(inp.paths[i]);
  }

  // Tarjan's SCC for cycles
  const sccs = tarjanSCC(out);
  const cycles: string[][] = [];
  for (const c of sccs) {
    if (c.length >= 2) cycles.push(c.map((i) => inp.paths[i]));
    else if (c.length === 1) {
      // self-loop?
      const i = c[0];
      if (out[i].includes(i)) cycles.push([inp.paths[i]]);
    }
  }

  const n = Math.max(inp.paths.length, 1);
  const meanFanIn = inDeg.reduce((a, b) => a + b, 0) / n;
  const meanFanOut = outDeg.reduce((a, b) => a + b, 0) / n;
  const maxFanIn = inDeg.reduce((a, b) => Math.max(a, b), 0);

  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  inp.paths.forEach((p, i) => { fanIn.set(p, inDeg[i]); fanOut.set(p, outDeg[i]); });

  return { numNodes: inp.paths.length, numEdges: inp.edges.length, orphans, cycles, meanFanIn, meanFanOut, maxFanIn, fanIn, fanOut };
}

function tarjanSCC(adj: number[][]): number[][] {
  const n = adj.length;
  const index = new Int32Array(n).fill(-1);
  const lowlink = new Int32Array(n);
  const onStack = new Uint8Array(n);
  const stack: number[] = [];
  const out: number[][] = [];
  let counter = 0;

  // Iterative Tarjan to avoid stack overflow on big repos.
  const callStack: { v: number; pi: number }[] = [];
  for (let v0 = 0; v0 < n; v0++) {
    if (index[v0] !== -1) continue;
    callStack.push({ v: v0, pi: 0 });
    index[v0] = counter; lowlink[v0] = counter; counter++;
    stack.push(v0); onStack[v0] = 1;

    while (callStack.length) {
      const frame = callStack[callStack.length - 1];
      const { v } = frame;
      const succs = adj[v];
      if (frame.pi < succs.length) {
        const w = succs[frame.pi++];
        if (index[w] === -1) {
          index[w] = counter; lowlink[w] = counter; counter++;
          stack.push(w); onStack[w] = 1;
          callStack.push({ v: w, pi: 0 });
        } else if (onStack[w]) {
          if (index[w] < lowlink[v]) lowlink[v] = index[w];
        }
      } else {
        // done with v
        if (lowlink[v] === index[v]) {
          const comp: number[] = [];
          while (true) {
            const w = stack.pop()!;
            onStack[w] = 0;
            comp.push(w);
            if (w === v) break;
          }
          out.push(comp);
        }
        callStack.pop();
        if (callStack.length) {
          const parent = callStack[callStack.length - 1].v;
          if (lowlink[v] < lowlink[parent]) lowlink[parent] = lowlink[v];
        }
      }
    }
  }
  return out;
}

/**
 * Bus factor for a file: smallest number of authors whose combined commits
 * cross 50% of total commits on that file. Plus the top author's share.
 */
export interface BusFactorRow {
  factor: number;
  topShare: number;
  totalCommits: number;
}
export function busFactor(authorCounts: Map<string, number>): BusFactorRow {
  const counts = Array.from(authorCounts.values()).sort((a, b) => b - a);
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return { factor: 0, topShare: 0, totalCommits: 0 };
  const half = total / 2;
  let acc = 0, factor = 0;
  for (let i = 0; i < counts.length; i++) {
    acc += counts[i]; factor++;
    if (acc > half) break;
  }
  return { factor, topShare: counts[0] / total, totalCommits: total };
}
