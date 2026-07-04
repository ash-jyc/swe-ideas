"""SQLite storage layer. Stdlib-only: imported on the hook fast path."""

from __future__ import annotations

import datetime
import sqlite3
from pathlib import Path

from vibetrace import FEATURES_VERSION, SCHEMA_VERSION, __version__

DDL = """
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Full-fidelity log of every hook payload; derived tables can be rebuilt from it.
CREATE TABLE IF NOT EXISTS raw_events (
    id              INTEGER PRIMARY KEY,
    ts              TEXT NOT NULL,
    hook_event_name TEXT,
    session_id      TEXT,
    payload_json    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id              TEXT PRIMARY KEY,
    project_dir     TEXT,
    transcript_path TEXT,
    started_at      TEXT,
    ended_at        TEXT,
    start_source    TEXT,
    end_reason      TEXT,
    model           TEXT
);

CREATE TABLE IF NOT EXISTS prompts (
    id               INTEGER PRIMARY KEY,
    session_id       TEXT NOT NULL REFERENCES sessions(id),
    seq              INTEGER NOT NULL,
    prompt_uuid      TEXT,
    ts               TEXT NOT NULL,
    cwd              TEXT,
    prompt_text      TEXT NOT NULL,
    prompt_sha256    TEXT NOT NULL,
    features_version TEXT NOT NULL,
    feat_char_len                INTEGER,
    feat_word_count              INTEGER,
    feat_line_count              INTEGER,
    feat_is_question             INTEGER,
    feat_starts_imperative       INTEGER,
    feat_has_code_block          INTEGER,
    feat_inline_code_count       INTEGER,
    feat_path_mention_count      INTEGER,
    feat_identifier_count        INTEGER,
    feat_mentions_security       INTEGER,
    feat_mentions_testing        INTEGER,
    feat_mentions_error_handling INTEGER,
    feat_vague_term_count        INTEGER,
    feat_constraint_count        INTEGER,
    feat_politeness              INTEGER,
    feat_urgency_shortcut        INTEGER,
    feat_negation_count          INTEGER,
    feat_references_previous     INTEGER,
    feat_specificity_score       REAL,
    features_json    TEXT
);
CREATE INDEX IF NOT EXISTS idx_prompts_session ON prompts(session_id, seq);
CREATE INDEX IF NOT EXISTS idx_prompts_uuid ON prompts(prompt_uuid);

-- Deduplicated, zlib-compressed file contents.
CREATE TABLE IF NOT EXISTS blobs (
    sha256     TEXT PRIMARY KEY,
    size_bytes INTEGER NOT NULL,
    content    BLOB
);

-- Pre-edit captures from PreToolUse. sha256 NULL means the file was confirmed
-- absent at capture time (a genuinely new file), which is distinct from having
-- no snapshot row at all (unknown prior state).
CREATE TABLE IF NOT EXISTS file_snapshots (
    id         INTEGER PRIMARY KEY,
    session_id TEXT NOT NULL,
    file_path  TEXT NOT NULL,
    sha256     TEXT REFERENCES blobs(sha256),
    ts         TEXT NOT NULL,
    origin     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_lookup ON file_snapshots(session_id, file_path, ts);

CREATE TABLE IF NOT EXISTS code_changes (
    id              INTEGER PRIMARY KEY,
    session_id      TEXT NOT NULL REFERENCES sessions(id),
    prompt_id       INTEGER REFERENCES prompts(id),
    ts              TEXT NOT NULL,
    tool_name       TEXT NOT NULL,
    file_path       TEXT NOT NULL,
    file_ext        TEXT,
    tool_input_json TEXT NOT NULL,
    before_sha256   TEXT REFERENCES blobs(sha256),
    after_sha256    TEXT REFERENCES blobs(sha256),
    after_size_bytes INTEGER
);
CREATE INDEX IF NOT EXISTS idx_changes_session ON code_changes(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_changes_prompt ON code_changes(prompt_id);

CREATE TABLE IF NOT EXISTS scans (
    id               INTEGER PRIMARY KEY,
    code_change_id   INTEGER NOT NULL REFERENCES code_changes(id),
    target           TEXT NOT NULL CHECK (target IN ('after', 'before')),
    target_sha256    TEXT,
    status           TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued','running','done','error','skipped_unsupported','superseded')),
    queued_at        TEXT NOT NULL,
    finished_at      TEXT,
    duration_ms      INTEGER,
    semgrep_version  TEXT,
    rules_config     TEXT,
    semgrep_exit_code INTEGER,
    error_text       TEXT,
    findings_count   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status, queued_at);
CREATE INDEX IF NOT EXISTS idx_scans_change ON scans(code_change_id);

CREATE TABLE IF NOT EXISTS findings (
    id          INTEGER PRIMARY KEY,
    scan_id     INTEGER NOT NULL REFERENCES scans(id),
    rule_id     TEXT NOT NULL,
    severity    TEXT,
    cwe         TEXT,          -- JSON array of CWE strings
    owasp       TEXT,          -- JSON array
    confidence  TEXT,
    message     TEXT,
    start_line  INTEGER,
    end_line    INTEGER,
    start_col   INTEGER,
    end_col     INTEGER,
    snippet     TEXT,
    fingerprint TEXT NOT NULL, -- line-number-independent identity (see scanner.attribution)
    is_new      INTEGER        -- 1 new vs before-content, 0 pre-existing, NULL unknown
);
CREATE INDEX IF NOT EXISTS idx_findings_scan ON findings(scan_id);

-- Cache of parsed semgrep output keyed by exact scanned content + config, so
-- identical content is never rescanned (rapid successive edits, before==after).
CREATE TABLE IF NOT EXISTS scan_cache (
    target_sha256   TEXT NOT NULL,
    rules_config    TEXT NOT NULL,
    semgrep_version TEXT NOT NULL,
    findings_json   TEXT NOT NULL,
    scanned_at      TEXT NOT NULL,
    PRIMARY KEY (target_sha256, rules_config, semgrep_version)
);
"""


def utcnow() -> str:
    """UTC ISO-8601 timestamp with millisecond precision, e.g. 2026-07-04T12:34:56.789Z."""
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def connect(db_path: str | Path) -> sqlite3.Connection:
    """Open (creating if needed) the trace DB with settings safe for concurrent hooks."""
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=2.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=2000")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript(DDL)
    conn.executemany(
        "INSERT OR IGNORE INTO meta(key, value) VALUES (?, ?)",
        [
            ("schema_version", SCHEMA_VERSION),
            ("features_version", FEATURES_VERSION),
            ("vibetrace_version", __version__),
            ("created_at", utcnow()),
        ],
    )
    conn.commit()
    return conn
