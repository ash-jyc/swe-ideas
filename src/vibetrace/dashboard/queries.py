"""Read-only queries and statistics shared by the dashboard and the exporter.

No Flask imports here: everything takes a sqlite3 connection (row_factory=Row)
so the exporter and tests can use these without a web app.
"""

from __future__ import annotations

import math
import sqlite3
import statistics

from vibetrace.features import FEATURE_NAMES

# Binary splits shown on /stats: (column, human label). Count-valued features
# are binarized as >0 ("present").
SPLIT_FEATURES = [
    ("feat_mentions_security", "Mentions security"),
    ("feat_mentions_testing", "Mentions testing"),
    ("feat_mentions_error_handling", "Mentions error handling"),
    ("feat_vague_term_count", "Vague wording"),
    ("feat_urgency_shortcut", "Urgency/shortcut wording"),
    ("feat_is_question", "Question form"),
    ("feat_starts_imperative", "Imperative form"),
    ("feat_has_code_block", "Includes code block"),
    ("feat_path_mention_count", "Mentions file paths"),
    ("feat_identifier_count", "Mentions identifiers"),
    ("feat_constraint_count", "States constraints"),
    ("feat_politeness", "Polite phrasing"),
    ("feat_references_previous", "Continues previous ask"),
]


def overview(conn: sqlite3.Connection) -> dict:
    one = lambda sql, *a: conn.execute(sql, a).fetchone()[0]  # noqa: E731
    return {
        "sessions": one("SELECT COUNT(*) FROM sessions"),
        "prompts": one("SELECT COUNT(*) FROM prompts"),
        "code_changes": one("SELECT COUNT(*) FROM code_changes"),
        "findings": one("SELECT COUNT(*) FROM findings f JOIN scans s ON s.id=f.scan_id WHERE s.target='after'"),
        "new_findings": one("SELECT COUNT(*) FROM findings WHERE is_new=1"),
        "pending_scans": one("SELECT COUNT(*) FROM scans WHERE status IN ('queued','running')"),
        "error_scans": one("SELECT COUNT(*) FROM scans WHERE status='error'"),
    }


def sessions_list(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT s.*,
               (SELECT COUNT(*) FROM prompts p WHERE p.session_id = s.id) AS n_prompts,
               (SELECT COUNT(*) FROM code_changes c WHERE c.session_id = s.id) AS n_changes,
               (SELECT COUNT(*) FROM findings f
                  JOIN scans sc ON sc.id = f.scan_id
                  JOIN code_changes c ON c.id = sc.code_change_id
                 WHERE c.session_id = s.id AND sc.target='after' AND f.is_new = 1) AS n_new_findings
        FROM sessions s
        ORDER BY s.started_at DESC
        """
    ).fetchall()


def session_timeline(conn: sqlite3.Connection, session_id: str) -> list[dict]:
    """Prompts in order, each with its changes, each with scan status + findings."""
    prompts = conn.execute(
        "SELECT * FROM prompts WHERE session_id=? ORDER BY seq", (session_id,)
    ).fetchall()
    timeline = []
    for p in prompts:
        changes = conn.execute(
            "SELECT * FROM code_changes WHERE prompt_id=? ORDER BY ts", (p["id"],)
        ).fetchall()
        timeline.append({"prompt": p, "changes": [_change_with_findings(conn, c) for c in changes]})
    orphans = conn.execute(
        "SELECT * FROM code_changes WHERE session_id=? AND prompt_id IS NULL ORDER BY ts",
        (session_id,),
    ).fetchall()
    if orphans:
        timeline.append({"prompt": None, "changes": [_change_with_findings(conn, c) for c in orphans]})
    return timeline


def _change_with_findings(conn: sqlite3.Connection, change: sqlite3.Row) -> dict:
    scan = conn.execute(
        "SELECT * FROM scans WHERE code_change_id=? AND target='after' ORDER BY id DESC LIMIT 1",
        (change["id"],),
    ).fetchone()
    findings = []
    if scan:
        findings = conn.execute(
            "SELECT * FROM findings WHERE scan_id=? ORDER BY start_line", (scan["id"],)
        ).fetchall()
    return {"change": change, "scan": scan, "findings": findings}


def prompt_detail(conn: sqlite3.Connection, prompt_id: int) -> dict | None:
    p = conn.execute("SELECT * FROM prompts WHERE id=?", (prompt_id,)).fetchone()
    if p is None:
        return None
    changes = conn.execute(
        "SELECT * FROM code_changes WHERE prompt_id=? ORDER BY ts", (prompt_id,)
    ).fetchall()
    return {
        "prompt": p,
        "features": [(name, p[f"feat_{name}"]) for name in FEATURE_NAMES],
        "changes": [_change_with_findings(conn, c) for c in changes],
    }


def change_detail(conn: sqlite3.Connection, change_id: int) -> dict | None:
    from vibetrace.capture import load_blob

    c = conn.execute("SELECT * FROM code_changes WHERE id=?", (change_id,)).fetchone()
    if c is None:
        return None
    def text_of(sha):
        if not sha:
            return None
        raw = load_blob(conn, sha)
        return raw.decode("utf-8", errors="replace") if raw is not None else None
    scans = conn.execute(
        "SELECT * FROM scans WHERE code_change_id=? ORDER BY target", (change_id,)
    ).fetchall()
    return {
        "change": c,
        "before_text": text_of(c["before_sha256"]),
        "after_text": text_of(c["after_sha256"]),
        "scans": scans,
        **_change_with_findings(conn, c),
    }


# --- research aggregates ------------------------------------------------------

def prompt_outcomes(conn: sqlite3.Connection) -> list[dict]:
    """One row per prompt: all feature columns + aggregated security outcomes.
    This is the flat.csv shape and the input to every /stats view."""
    feat_cols = ", ".join(f"p.feat_{n}" for n in FEATURE_NAMES)
    rows = conn.execute(
        f"""
        SELECT p.id AS prompt_id, p.session_id, p.seq, p.ts, p.prompt_sha256,
               p.features_version, {feat_cols},
               COUNT(DISTINCT c.id) AS n_changes,
               COUNT(DISTINCT c.file_path) AS n_files_touched,
               COUNT(f.id) AS n_findings_total,
               COALESCE(SUM(f.is_new = 1), 0) AS n_findings_new,
               COALESCE(SUM(f.is_new = 1 AND f.severity = 'ERROR'), 0) AS n_new_error,
               COALESCE(SUM(f.is_new = 1 AND f.severity = 'WARNING'), 0) AS n_new_warning,
               COALESCE(SUM(f.is_new = 1 AND f.severity = 'INFO'), 0) AS n_new_info,
               COUNT(DISTINCT CASE WHEN f.is_new = 1 THEN f.rule_id END) AS distinct_new_rules,
               COALESCE(SUM(sc.status IN ('queued', 'running')), 0) AS n_scans_pending
        FROM prompts p
        LEFT JOIN code_changes c ON c.prompt_id = p.id
        LEFT JOIN scans sc ON sc.code_change_id = c.id AND sc.target = 'after'
        LEFT JOIN findings f ON f.scan_id = sc.id
        GROUP BY p.id
        ORDER BY p.session_id, p.seq
        """
    ).fetchall()
    return [dict(r) for r in rows]


def point_biserial(binary: list[int], values: list[float]) -> float | None:
    """Correlation between a 0/1 feature and a continuous outcome.
    r = (M1 - M0) / s * sqrt(n1*n0 / n^2); None when undefined."""
    n = len(binary)
    if n < 2 or len(values) != n:
        return None
    ones = [v for b, v in zip(binary, values) if b]
    zeros = [v for b, v in zip(binary, values) if not b]
    if not ones or not zeros:
        return None
    s = statistics.pstdev(values)
    if s == 0:
        return None
    r = (statistics.mean(ones) - statistics.mean(zeros)) / s
    return round(r * math.sqrt(len(ones) * len(zeros) / n**2), 3)


def feature_outcome_table(outcomes: list[dict]) -> list[dict]:
    """Per split feature: prevalence and mean new-findings with/without, plus r."""
    table = []
    values = [o["n_findings_new"] for o in outcomes]
    for col, label in SPLIT_FEATURES:
        binary = [1 if (o[col] or 0) > 0 else 0 for o in outcomes]
        ones = [v for b, v in zip(binary, values) if b]
        zeros = [v for b, v in zip(binary, values) if not b]
        table.append({
            "column": col,
            "label": label,
            "n_present": len(ones),
            "n_absent": len(zeros),
            "mean_new_present": round(statistics.mean(ones), 2) if ones else None,
            "mean_new_absent": round(statistics.mean(zeros), 2) if zeros else None,
            "r": point_biserial(binary, values),
        })
    return table


def length_bucket_rates(outcomes: list[dict]) -> list[tuple[str, float, int]]:
    """Mean new findings per prompt, bucketed by prompt length quartile."""
    if not outcomes:
        return []
    ordered = sorted(outcomes, key=lambda o: o["feat_char_len"] or 0)
    n = len(ordered)
    buckets = []
    for i in range(4):
        chunk = ordered[i * n // 4: (i + 1) * n // 4] or []
        if not chunk:
            continue
        lo = chunk[0]["feat_char_len"]
        hi = chunk[-1]["feat_char_len"]
        mean_new = statistics.mean(o["n_findings_new"] for o in chunk)
        buckets.append((f"Q{i+1} ({lo}–{hi} chars)", round(mean_new, 2), len(chunk)))
    return buckets


def findings_by_rule(conn: sqlite3.Connection, limit: int = 12) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT f.rule_id, COUNT(*) AS n, SUM(f.is_new = 1) AS n_new
        FROM findings f JOIN scans s ON s.id = f.scan_id
        WHERE s.target = 'after'
        GROUP BY f.rule_id ORDER BY n DESC LIMIT ?
        """,
        (limit,),
    ).fetchall()


def findings_by_severity(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT COALESCE(f.severity, 'UNKNOWN') AS severity, COUNT(*) AS n,
               SUM(f.is_new = 1) AS n_new
        FROM findings f JOIN scans s ON s.id = f.scan_id
        WHERE s.target = 'after'
        GROUP BY f.severity
        ORDER BY CASE f.severity WHEN 'ERROR' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END
        """
    ).fetchall()
