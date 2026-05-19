import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = process.env.HEALTH_DB_PATH || path.join(process.cwd(), "data", "health.db");

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const d = new Database(DB_PATH);
  d.pragma("journal_mode = WAL");
  d.pragma("synchronous = NORMAL");
  d.exec(SCHEMA);
  _db = d;
  return d;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS repo (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  url TEXT NOT NULL,
  branch TEXT NOT NULL,
  ingested_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS commits (
  sha TEXT PRIMARY KEY,
  parent TEXT,
  author TEXT NOT NULL,
  email TEXT NOT NULL,
  ts INTEGER NOT NULL,
  message TEXT NOT NULL,
  idx INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_commits_ts ON commits(ts);

CREATE TABLE IF NOT EXISTS scores (
  sha TEXT PRIMARY KEY,
  health REAL NOT NULL,
  complexity_drift REAL NOT NULL,
  test_coverage REAL NOT NULL,
  hotspot_risk REAL NOT NULL,
  dependency_rot REAL NOT NULL,
  arch_drift REAL NOT NULL DEFAULT 0,
  total_files INTEGER NOT NULL,
  total_loc INTEGER NOT NULL,
  total_complexity INTEGER NOT NULL,
  test_files INTEGER NOT NULL,
  source_files INTEGER NOT NULL,
  num_deps INTEGER NOT NULL,
  commits_since_deps_change INTEGER NOT NULL,
  num_orphans INTEGER NOT NULL DEFAULT 0,
  num_cycles INTEGER NOT NULL DEFAULT 0,
  mean_fan_in REAL NOT NULL DEFAULT 0,
  mean_fan_out REAL NOT NULL DEFAULT 0,
  bus_factor_low INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (sha) REFERENCES commits(sha)
);

CREATE TABLE IF NOT EXISTS hotspots (
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  churn INTEGER NOT NULL,
  complexity INTEGER NOT NULL,
  risk REAL NOT NULL,
  PRIMARY KEY (sha, path)
);
CREATE INDEX IF NOT EXISTS idx_hotspots_sha ON hotspots(sha);

CREATE TABLE IF NOT EXISTS nodes (
  sha TEXT NOT NULL,
  id TEXT NOT NULL,
  kind TEXT NOT NULL,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  lang TEXT,
  loc INTEGER NOT NULL,
  complexity INTEGER NOT NULL,
  PRIMARY KEY (sha, id)
);
CREATE INDEX IF NOT EXISTS idx_nodes_sha ON nodes(sha);
CREATE INDEX IF NOT EXISTS idx_nodes_path ON nodes(sha, path);

CREATE TABLE IF NOT EXISTS edges (
  sha TEXT NOT NULL,
  src TEXT NOT NULL,
  dst TEXT NOT NULL,
  kind TEXT NOT NULL,
  PRIMARY KEY (sha, src, dst, kind)
);
CREATE INDEX IF NOT EXISTS idx_edges_sha ON edges(sha);

CREATE TABLE IF NOT EXISTS file_authors (
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  author TEXT NOT NULL,
  commits INTEGER NOT NULL,
  PRIMARY KEY (sha, path, author)
);
CREATE INDEX IF NOT EXISTS idx_fa_sha_path ON file_authors(sha, path);

CREATE TABLE IF NOT EXISTS bus_factor (
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  factor INTEGER NOT NULL,        -- min # of authors who together own >50% of commits
  top_share REAL NOT NULL,        -- share of top author (0..1)
  total_commits INTEGER NOT NULL,
  PRIMARY KEY (sha, path)
);
CREATE INDEX IF NOT EXISTS idx_bf_sha ON bus_factor(sha);

CREATE TABLE IF NOT EXISTS cycles (
  sha TEXT NOT NULL,
  cycle_id INTEGER NOT NULL,
  member TEXT NOT NULL,
  size INTEGER NOT NULL,
  PRIMARY KEY (sha, cycle_id, member)
);
CREATE INDEX IF NOT EXISTS idx_cycles_sha ON cycles(sha);

CREATE TABLE IF NOT EXISTS orphans (
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  PRIMARY KEY (sha, path)
);
CREATE INDEX IF NOT EXISTS idx_orphans_sha ON orphans(sha);

CREATE TABLE IF NOT EXISTS narratives (
  sha TEXT NOT NULL,
  prev_sha TEXT NOT NULL,
  text TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (sha, prev_sha)
);
`;
