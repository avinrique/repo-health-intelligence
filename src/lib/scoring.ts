import type { CommitAggregate } from "./metrics";

export interface ScoreInputs {
  agg: CommitAggregate;
  baselineAvgComplexity: number; // from first analyzed commit (>0)
  churnByPath: Map<string, number>; // cumulative churn up to this commit
  complexityByPath: Map<string, number>;
  numDeps: number;
  commitsSinceDepsChange: number;
}

export interface ScoreResult {
  health: number;
  complexityDrift: number; // 0..1, higher = worse
  testCoverage: number; // 0..1, higher = better
  hotspotRisk: number; // 0..1, higher = worse
  dependencyRot: number; // 0..1, higher = worse
  hotspots: { path: string; churn: number; complexity: number; risk: number }[];
}

export function score(inp: ScoreInputs): ScoreResult {
  const { agg, baselineAvgComplexity, churnByPath, complexityByPath, numDeps, commitsSinceDepsChange } = inp;

  // 1) Complexity drift: how much avg complexity grew vs baseline.
  //    drift = clamp((avg - base) / max(base, 1), 0, 1)
  const drift = baselineAvgComplexity > 0
    ? clamp01((agg.avgComplexity - baselineAvgComplexity) / Math.max(baselineAvgComplexity, 1))
    : 0;

  // 2) Test coverage proxy = testFiles / max(sourceFiles, 1), capped.
  const testCoverage = agg.sourceFiles > 0
    ? Math.min(1, agg.testFiles / Math.max(agg.sourceFiles, 1))
    : 0;

  // 3) Hotspot risk: top 10 files by churn*complexity, normalize against the
  //    theoretical max if everything were a hotspot.
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
  const concentration = topRiskSum / totalRiskSum; // 0..1
  const maxFileRisk = top[0]?.risk || 0;
  const intensity = clamp01(Math.log10(1 + maxFileRisk) / 3); // log scale, saturates at risk ~ 1000
  const hotspotRisk = clamp01(0.6 * concentration + 0.4 * intensity);

  // 4) Dependency rot: more deps AND longer since deps changed = worse.
  //    dep_pressure  = clamp(numDeps / 80, 0, 1)
  //    staleness     = clamp(commitsSinceDepsChange / 50, 0, 1)
  const depPressure = clamp01(numDeps / 80);
  const staleness = clamp01(commitsSinceDepsChange / 50);
  const dependencyRot = clamp01(0.5 * depPressure + 0.5 * staleness);

  // Composite. Weights:
  //   complexity drift  30  (inverted)
  //   test coverage     30
  //   hotspot risk      20  (inverted)
  //   dependency rot    20  (inverted)
  const health =
    30 * (1 - drift) +
    30 * testCoverage +
    20 * (1 - hotspotRisk) +
    20 * (1 - dependencyRot);

  return {
    health: round1(health),
    complexityDrift: round3(drift),
    testCoverage: round3(testCoverage),
    hotspotRisk: round3(hotspotRisk),
    dependencyRot: round3(dependencyRot),
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
