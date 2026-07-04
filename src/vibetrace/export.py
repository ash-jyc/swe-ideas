"""Research exports: flat CSV (one row per prompt), per-table CSVs, JSON dump.

The dashboard's /export routes call these same functions, so the CLI and the
web UI can never drift apart.
"""

from __future__ import annotations

import csv
import io
import json
import sqlite3
from pathlib import Path

from vibetrace import db
from vibetrace.dashboard import queries


def flat_csv_text(conn: sqlite3.Connection) -> str:
    """One row per prompt: features + aggregated security outcomes (the primary
    research artifact; column meanings are documented in the README codebook)."""
    rows = queries.prompt_outcomes(conn)
    buf = io.StringIO()
    if not rows:
        return ""
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()


TABLE_COLUMNS = {
    "prompts": None,  # all columns
    "code_changes": None,
    "findings": None,
    "sessions": None,
    "scans": None,
}


def table_csv_text(conn: sqlite3.Connection, table: str) -> str:
    if table not in TABLE_COLUMNS:
        raise ValueError(f"unknown table: {table}")
    rows = conn.execute(f"SELECT * FROM {table}").fetchall()
    buf = io.StringIO()
    if not rows:
        return ""
    writer = csv.writer(buf)
    writer.writerow(rows[0].keys())
    writer.writerows([tuple(r) for r in rows])
    return buf.getvalue()


def dump_json_text(conn: sqlite3.Connection) -> str:
    doc = {
        "meta": dict(conn.execute("SELECT key, value FROM meta")),
        "scan_configs": [
            dict(r) for r in conn.execute(
                "SELECT DISTINCT rules_config, semgrep_version FROM scans"
                " WHERE rules_config IS NOT NULL"
            )
        ],
    }
    for table in ("sessions", "prompts", "code_changes", "scans", "findings"):
        doc[table] = [dict(r) for r in conn.execute(f"SELECT * FROM {table}")]
    return json.dumps(doc, indent=1, ensure_ascii=False)


def export_all(db_path: Path, out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    conn = db.connect(db_path)
    written = []
    try:
        for name, text in [
            ("flat.csv", flat_csv_text(conn)),
            ("prompts.csv", table_csv_text(conn, "prompts")),
            ("changes.csv", table_csv_text(conn, "code_changes")),
            ("findings.csv", table_csv_text(conn, "findings")),
            ("dump.json", dump_json_text(conn)),
        ]:
            path = out_dir / name
            path.write_text(text, encoding="utf-8")
            written.append(path)
    finally:
        conn.close()
    return written
