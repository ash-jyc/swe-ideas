import re
import sqlite3

from vibetrace import SCHEMA_VERSION
from vibetrace.db import connect, utcnow


def test_connect_creates_schema(tmp_path):
    conn = connect(tmp_path / "trace.db")
    tables = {
        r["name"]
        for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    }
    assert {
        "meta", "raw_events", "sessions", "prompts", "blobs",
        "file_snapshots", "code_changes", "scans", "findings", "scan_cache",
    } <= tables
    meta = dict(conn.execute("SELECT key, value FROM meta"))
    assert meta["schema_version"] == SCHEMA_VERSION
    conn.close()


def test_connect_is_idempotent(tmp_path):
    p = tmp_path / "trace.db"
    connect(p).close()
    conn = connect(p)  # must not fail on existing schema
    assert conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0
    conn.close()


def test_wal_mode(tmp_path):
    conn = connect(tmp_path / "trace.db")
    assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
    conn.close()


def test_scan_status_constraint(tmp_path):
    conn = connect(tmp_path / "trace.db")
    conn.execute("INSERT INTO sessions(id) VALUES ('s1')")
    conn.execute(
        "INSERT INTO code_changes(session_id, ts, tool_name, file_path, tool_input_json)"
        " VALUES ('s1', ?, 'Write', '/tmp/x.py', '{}')",
        (utcnow(),),
    )
    try:
        conn.execute(
            "INSERT INTO scans(code_change_id, target, status, queued_at)"
            " VALUES (1, 'after', 'bogus', ?)",
            (utcnow(),),
        )
        raised = False
    except sqlite3.IntegrityError:
        raised = True
    assert raised
    conn.close()


def test_utcnow_format():
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z", utcnow())
