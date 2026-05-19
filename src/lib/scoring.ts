import type { CommitAggregate } from "./metrics";

export interface ScoreInputs {
  agg: CommitAggregate;
  baselineAvgComplexity: number;
  churnByPath: Map<string, number>;
  complexityByPath: Map<string, number>;
  numDeps: number;
  commitsSinceDepsChange: number;
  arch: {
    numCycles: number;
    numOrphans: number;
    maxFanIn: number;
    numNodes: number;
  };
  baselineArch: {
    numCycles: number;
    numOrphans: number;
    maxFanIn: number;
    numNodes: number;
  };
}

export interface ScoreResult {
  health: number;
  complexityDrift: number;
  testCoverage: number;
  hotspotRisk: number;
  dependencyRot: number;
  archDrift: number;
  hotspots: { path: string; churn: number; complexity: number; risk: number }[];
}

export function score(inp: ScoreInputs): ScoreResult {
  const { agg, baselineAvgComplexity, churnByPath, complexityByPath, numDeps, commitsSinceDepsChange, arch, baselineArch } = inp;

  const drift = baselineAvgComplexity > 0
    ? clamp01((agg.avgComplexity - baselineAvgComplexity) / Math.max(baselineAvgComplexity, 1))
    : 0;

  const testCoverage = agg.sourceFiles > 0
    ? Math.min(1, agg.testFiles / Math.max(agg.sourceFiles, 1))
    : 0;

  const perFile: { path: string; churn: number; complexity: number; risk: number }[] = [];
  for (const [path, churn] of churnByPath) {
    const cx = complexityByPath.get(path) || 0;
    if (cx <= 0) continue;
    perFile.push({ path, churn, complexity: cx, risk: churn * cx });
  }
  perFile.sort((a, b) => b.risk - a.risk);
  const top = perFile.slice(0, 10);
  const topRiskSum = top.reduce((a, f) => a + f.risk, 0);
  const totalRiskSum = perFile.reduce((a, f) => a + f.risk, 0) || 1;
  const concentration = topRiskSum / totalRiskSum;
  const maxFileRisk = top[0]?.risk || 0;
  const intensity = clamp01(Math.log10(1 + maxFileRisk) / 3);
  const hotspotRisk = clamp01(0.6 * concentration + 0.4 * intensity);

  const depPressure = clamp01(numDeps / 80);
  const staleness = clamp01(commitsSinceDepsChange / 50);
  const dependencyRot = clamp01(0.5 * depPressure + 0.5 * staleness);

  // Architectural drift: blend of growth in (cycles, orphan ratio, max fan-in)
  // relative to baseline. All three saturate quickly so the metric reads as
  // "topology is decaying" rather than just "repo grew".
  const cycGrowth = baselineArch.numCycles >= 0
    ? clamp01((arch.numCycles - baselineArch.numCycles) / 5)
    : 0;
  const orphanRatio = arch.numNodes > 0 ? arch.numOrphans / arch.numNodes : 0;
  const baseOrphanRatio = baselineArch.numNodes > 0 ? baselineArch.numOrphans / baselineArch.numNodes : 0;
  const orphanGrowth = clamp01(orphanRatio - baseOrphanRatio);
  const fanInGrowth = baselineArch.maxFanIn > 0
    ? clamp01((arch.maxFanIn - baselineArch.maxFanIn) / Math.max(baselineArch.maxFanIn, 5))
    : clamp01(arch.maxFanIn / 30);
  const archDrift = clamp01(0.4 * cycGrowth + 0.3 * orphanGrowth + 0.3 * fanInGrowth);

  // Composite. 5 subscores.
  //   complexity drift  25 (inverted)
  //   test coverage     25
  //   hotspot risk      20 (inverted)
  //   dependency rot    15 (inverted)
  //   arch drift        15 (inverted)
  const health =
    25 * (1 - drift) +
    25 * testCoverage +
    20 * (1 - hotspotRisk) +
    15 * (1 - dependencyRot) +
    15 * (1 - archDrift);

  return {
    health: round1(health),
    complexityDrift: round3(drift),
    testCoverage: round3(testCoverage),
    hotspotRisk: round3(hotspotRisk),
    dependencyRot: round3(dependencyRot),
    archDrift: round3(archDrift),
    hotspots: top,
  };
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
function round1(x: number) { return Math.round(x * 10) / 10; }
function round3(x: number) { return Math.round(x * 1000) / 1000; }
