"""Detached scan worker: drains queued Semgrep scans out-of-process so hooks
never add scan latency to the coding session.

Concurrency model: any number of processors are safe — each scan row is
claimed atomically (status queued->running), and results for identical content
are cached in scan_cache, so a background worker and `vibetrace scan --drain`
can coexist. The lockfile only prevents piling up redundant background
workers.

Run as: python -m vibetrace.scanner.worker <project_dir>
"""

from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from vibetrace import capture, config, db
from vibetrace.scanner import attribution
from vibetrace.scanner.semgrep_runner import (
    Finding,
    run_semgrep,
    semgrep_executable,
    semgrep_version,
)

LOCKFILE = "worker.lock"


def spawn_detached(project_dir: Path) -> None:
    subprocess.Popen(
        [sys.executable, "-m", "vibetrace.scanner.worker", str(project_dir)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
        close_fds=True,
    )


def _log(vt_dir: Path, message: str) -> None:
    try:
        with open(vt_dir / "logs" / "worker.log", "a", encoding="utf-8") as fh:
            fh.write(f"{db.utcnow()} [{os.getpid()}] {message}\n")
    except OSError:
        pass


def ingest_spool(conn: sqlite3.Connection, project_dir: Path, max_blob_bytes: int) -> int:
    """Replay payloads the hook spooled when the DB was unavailable."""
    spool = config.vibetrace_dir(project_dir) / "spool"
    count = 0
    if not spool.is_dir():
        return 0
    for path in sorted(spool.glob("*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                capture.dispatch_event(conn, payload, project_dir, max_blob_bytes)
            path.unlink()
            count += 1
        except (OSError, ValueError) as exc:
            _log(config.vibetrace_dir(project_dir), f"spool {path.name}: {exc}")
            path.rename(path.with_suffix(".bad"))
    return count


def _current_semgrep_version() -> str:
    if os.environ.get("VIBETRACE_FAKE_SEMGREP"):
        return "fake"
    exe = semgrep_executable()
    return semgrep_version(exe) if exe else "unknown"


def _findings_to_json(findings: list[Finding]) -> str:
    return json.dumps([f.__dict__ for f in findings])


def _findings_from_json(text: str) -> list[Finding]:
    return [Finding(**d) for d in json.loads(text)]


def _insert_findings(
    conn: sqlite3.Connection,
    scan_id: int,
    marked: list[tuple[Finding, str, int | None]],
) -> None:
    conn.executemany(
        "INSERT INTO findings(scan_id, rule_id, severity, cwe, owasp, confidence,"
        " message, start_line, end_line, start_col, end_col, snippet, fingerprint, is_new)"
        " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
            (
                scan_id, f.rule_id, f.severity, json.dumps(f.cwe), json.dumps(f.owasp),
                f.confidence, f.message, f.start_line, f.end_line, f.start_col,
                f.end_col, f.snippet, fp, is_new,
            )
            for f, fp, is_new in marked
        ],
    )


def _scan_content(
    conn: sqlite3.Connection,
    sha256: str,
    file_ext: str,
    rules_config: str,
    timeout_s: int,
) -> tuple[list[Finding], str | None, int]:
    """Scan exact blob content (cached). Returns (findings, error_summary, exit_code)."""
    version = _current_semgrep_version()
    cached = conn.execute(
        "SELECT findings_json FROM scan_cache WHERE target_sha256=? AND rules_config=?"
        " AND semgrep_version=?",
        (sha256, rules_config, version),
    ).fetchone()
    if cached:
        return _findings_from_json(cached["findings_json"]), None, 0

    content = capture.load_blob(conn, sha256)
    if content is None:
        raise RuntimeError("blob content unavailable (oversized or missing)")
    with tempfile.TemporaryDirectory(prefix="vibetrace-scan-") as tmp:
        # only allowlisted simple extensions reach this point
        target = Path(tmp) / f"target.{file_ext or 'txt'}"
        target.write_bytes(content)
        result = run_semgrep(target, rules_config, timeout_s)
    attribution.hydrate_snippets(
        result.findings, content.decode("utf-8", errors="replace")
    )
    conn.execute(
        "INSERT OR REPLACE INTO scan_cache(target_sha256, rules_config, semgrep_version,"
        " findings_json, scanned_at) VALUES (?,?,?,?,?)",
        (sha256, rules_config, version, _findings_to_json(result.findings), db.utcnow()),
    )
    return result.findings, result.errors, result.exit_code


def _before_fingerprints(
    conn: sqlite3.Connection, change: sqlite3.Row
) -> set[str] | None:
    """Fingerprint set of the pre-edit content's findings, or None if unknowable.

    - before == after content: the edit was a no-op for content -> use after's
      own fingerprints (everything pre-existing); handled by caller via equality.
    - before scanned: use its findings.
    - confirmed new file (snapshot row with NULL sha): empty set (all new).
    - no snapshot at all / before scan failed: None (unknown).
    """
    if change["before_sha256"] is None:
        snap = conn.execute(
            "SELECT sha256 FROM file_snapshots WHERE session_id=? AND file_path=?"
            " AND ts <= ? ORDER BY ts DESC, id DESC LIMIT 1",
            (change["session_id"], change["file_path"], change["ts"]),
        ).fetchone()
        if snap is not None and snap["sha256"] is None:
            return set()  # file confirmed absent before the edit
        return None
    before_scan = conn.execute(
        "SELECT * FROM scans WHERE code_change_id=? AND target='before'"
        " ORDER BY id DESC LIMIT 1",
        (change["id"],),
    ).fetchone()
    if before_scan is None or before_scan["status"] != "done":
        return None
    rows = conn.execute(
        "SELECT fingerprint FROM findings WHERE scan_id=?", (before_scan["id"],)
    ).fetchall()
    return {r["fingerprint"] for r in rows}


def process_one(conn: sqlite3.Connection, cfg: dict, vt_dir: Path) -> bool:
    """Claim and process the next queued scan. Returns False when queue is empty.

    Ordering: oldest first; 'before' before 'after' within a change, so the
    after-scan can attribute against completed before-findings.
    """
    row = conn.execute(
        "SELECT s.*, c.file_ext, c.file_path, c.session_id AS c_session, c.ts AS c_ts,"
        " c.before_sha256, c.after_sha256"
        " FROM scans s JOIN code_changes c ON c.id = s.code_change_id"
        " WHERE s.status='queued'"
        " ORDER BY s.queued_at ASC, CASE s.target WHEN 'before' THEN 0 ELSE 1 END ASC"
        " LIMIT 1"
    ).fetchone()
    if row is None:
        return False
    claimed = conn.execute(
        "UPDATE scans SET status='running' WHERE id=? AND status='queued'", (row["id"],)
    )
    conn.commit()
    if claimed.rowcount != 1:
        return True  # another processor took it; look for more

    scan_id = row["id"]
    started = time.monotonic()
    rules = cfg["rules_config"]

    def finish(status, findings_count=None, exit_code=None, error=None):
        conn.execute(
            "UPDATE scans SET status=?, finished_at=?, duration_ms=?, semgrep_version=?,"
            " rules_config=?, semgrep_exit_code=?, error_text=?, findings_count=?"
            " WHERE id=?",
            (status, db.utcnow(), int((time.monotonic() - started) * 1000),
             _current_semgrep_version(), rules, exit_code, error, findings_count, scan_id),
        )
        conn.commit()

    try:
        if (row["file_ext"] or "") not in cfg["scan_extensions"]:
            finish("skipped_unsupported", findings_count=0)
            return True
        findings, errors, exit_code = _scan_content(
            conn, row["target_sha256"], row["file_ext"], rules, cfg["semgrep_timeout_s"]
        )
        if row["target"] == "before":
            marked = [(f, attribution.fingerprint(f), None) for f in findings]
        else:
            change = conn.execute(
                "SELECT * FROM code_changes WHERE id=?", (row["code_change_id"],)
            ).fetchone()
            if change["before_sha256"] is not None and change["before_sha256"] == change["after_sha256"]:
                marked = [(f, attribution.fingerprint(f), 0) for f in findings]
            else:
                marked = attribution.mark_new(findings, _before_fingerprints(conn, change))
        _insert_findings(conn, scan_id, marked)
        finish("done", findings_count=len(findings), exit_code=exit_code, error=errors)
        _log(vt_dir, f"scan {scan_id} ({row['target']} {row['file_path']}): "
                     f"{len(findings)} finding(s)")
    except Exception as exc:  # semgrep failure must not kill the worker
        finish("error", error=f"{type(exc).__name__}: {exc}")
        _log(vt_dir, f"scan {scan_id} failed: {exc}")
    return True


def drain(project_dir: Path, verbose: bool = False) -> int:
    """Synchronously process spool + queue until empty. Returns scans processed."""
    cfg = config.load_config(project_dir)
    vt_dir = config.vibetrace_dir(project_dir)
    conn = db.connect(config.db_path(project_dir))
    processed = 0
    try:
        ingest_spool(conn, project_dir, cfg["max_blob_bytes"])
        while process_one(conn, cfg, vt_dir):
            processed += 1
            if verbose:
                print(f"  processed scan {processed}", file=sys.stderr)
    finally:
        conn.close()
    return processed


def _acquire_lock(vt_dir: Path) -> bool:
    lock = vt_dir / LOCKFILE
    try:
        pid_text = lock.read_text().strip()
        if pid_text and _pid_alive(int(pid_text)):
            return False
    except (OSError, ValueError):
        pass
    try:
        lock.write_text(str(os.getpid()))
        return True
    except OSError:
        return False


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def main(project_dir: Path) -> int:
    cfg = config.load_config(project_dir)
    vt_dir = config.ensure_dirs(project_dir)
    if not _acquire_lock(vt_dir):
        return 0  # a live worker already owns the queue
    _log(vt_dir, "worker started")
    conn = db.connect(config.db_path(project_dir))
    idle_since = time.monotonic()
    try:
        while True:
            worked = ingest_spool(conn, project_dir, cfg["max_blob_bytes"]) > 0
            if process_one(conn, cfg, vt_dir):
                worked = True
            if worked:
                idle_since = time.monotonic()
                continue
            if time.monotonic() - idle_since > cfg["worker_idle_exit_s"]:
                break
            time.sleep(2)
    finally:
        conn.close()
        try:
            (vt_dir / LOCKFILE).unlink()
        except OSError:
            pass
        _log(vt_dir, "worker exiting")
    return 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()))
