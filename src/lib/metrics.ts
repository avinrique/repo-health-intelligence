import type { FileMetric } from "./types";

const TEST_RX = /(^|\/)(__tests__|tests?|spec)\/|\.(test|spec)\.(t|j)sx?$|_test\.py$|test_.*\.py$/i;
const SOURCE_DIRS = /^(src|app|lib|server|client|backend|frontend|api)\//i;

export function isTestFile(path: string): boolean {
  return TEST_RX.test(path);
}

export function isSourceFile(path: string): boolean {
  return !isTestFile(path);
}

export interface CommitAggregate {
  totalFiles: number;
  totalLoc: number;
  totalComplexity: number;
  avgComplexity: number;
  testFiles: number;
  sourceFiles: number;
}

export function aggregate(files: FileMetric[]): CommitAggregate {
  const totalFiles = files.length;
  const totalLoc = files.reduce((a, f) => a + f.loc, 0);
  const totalComplexity = files.reduce((a, f) => a + f.complexity, 0);
  const testFiles = files.filter((f) => isTestFile(f.path)).length;
  const sourceFiles = totalFiles - testFiles;
  return {
    totalFiles,
    totalLoc,
    totalComplexity,
    avgComplexity: totalFiles ? totalComplexity / totalFiles : 0,
    testFiles,
    sourceFiles,
  };
}
