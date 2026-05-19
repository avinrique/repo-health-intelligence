export type Lang = "ts" | "tsx" | "js" | "jsx" | "py";

export interface FileMetric {
  path: string;
  lang: Lang;
  loc: number;
  complexity: number;
  fnCount: number;
  classCount: number;
  imports: string[];
}

export interface CommitRow {
  sha: string;
  parent: string | null;
  author: string;
  email: string;
  ts: number; // unix seconds
  message: string;
  idx: number; // 0 = oldest, N = newest
}

export interface ScoreRow {
  sha: string;
  health: number;
  complexity_drift: number;
  test_coverage: number;
  hotspot_risk: number;
  dependency_rot: number;
  total_files: number;
  total_loc: number;
  total_complexity: number;
  test_files: number;
  source_files: number;
  num_deps: number;
  commits_since_deps_change: number;
}

export interface HotspotRow {
  sha: string;
  path: string;
  churn: number;
  complexity: number;
  risk: number;
}

export interface NodeRow {
  sha: string;
  id: string; // e.g. "file:src/foo.ts" or "fn:src/foo.ts#bar"
  kind: "file" | "function" | "class";
  path: string;
  name: string;
  lang: Lang | null;
  loc: number;
  complexity: number;
}

export interface EdgeRow {
  sha: string;
  src: string;
  dst: string;
  kind: "import" | "contains";
}
