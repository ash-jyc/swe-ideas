-- Platform database schema. Applied idempotently by migrate.ts.

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS turns (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  seq               INTEGER NOT NULL,
  prompt            TEXT NOT NULL,
  raw_response      TEXT NOT NULL,
  summary           TEXT,
  provider          TEXT NOT NULL,
  model             TEXT NOT NULL,
  base_url          TEXT,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  total_tokens      INTEGER,
  prompt_version    TEXT NOT NULL,
  status            TEXT NOT NULL,
  error             TEXT,
  created_at        INTEGER NOT NULL,
  completed_at      INTEGER,
  UNIQUE(project_id, seq)
);

-- Per-turn file operations plus the computed diff. Core research artifact.
CREATE TABLE IF NOT EXISTS turn_file_ops (
  id            TEXT PRIMARY KEY,
  turn_id       TEXT NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
  path          TEXT NOT NULL,
  op            TEXT NOT NULL,
  content_after TEXT,
  unified_diff  TEXT,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ops_turn ON turn_file_ops(turn_id);

-- Current materialized file set (fast reads for editor / tree / run).
CREATE TABLE IF NOT EXISTS project_files (
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path         TEXT NOT NULL,
  content      TEXT NOT NULL,
  updated_turn TEXT REFERENCES turns(id),
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (project_id, path)
);

-- Full snapshot of the file set as of each turn — exact time-travel.
CREATE TABLE IF NOT EXISTS turn_snapshots (
  turn_id TEXT NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
  path    TEXT NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (turn_id, path)
);

CREATE TABLE IF NOT EXISTS security_findings (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  turn_id       TEXT REFERENCES turns(id) ON DELETE SET NULL,
  analyzer      TEXT NOT NULL,
  severity      TEXT NOT NULL,
  cwe           TEXT,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  file          TEXT,
  line_start    INTEGER,
  line_end      INTEGER,
  confidence    REAL,
  metadata_json TEXT,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_findings_project ON security_findings(project_id);
CREATE INDEX IF NOT EXISTS idx_findings_turn ON security_findings(turn_id);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  turn_id       TEXT REFERENCES turns(id) ON DELETE CASCADE,
  analyzer      TEXT NOT NULL,
  status        TEXT NOT NULL,
  finding_count INTEGER NOT NULL DEFAULT 0,
  error         TEXT,
  started_at    INTEGER NOT NULL,
  finished_at   INTEGER
);

CREATE TABLE IF NOT EXISTS deployments (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL,
  turn_id    TEXT REFERENCES turns(id),
  status     TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deploy_slug ON deployments(slug);
CREATE INDEX IF NOT EXISTS idx_deploy_project ON deployments(project_id);
