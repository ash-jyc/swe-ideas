"""Claude Code hook entrypoint: python -m vibetrace.hook <event>

Robustness contract — this process runs inside the user's coding session:
  1. ALWAYS exit 0. Exit 2 would erase the user's prompt (UserPromptSubmit)
     or block stopping (Stop); other non-zero codes surface error notices.
  2. NEVER write to stdout. On UserPromptSubmit/SessionStart/Stop, stdout is
     injected into Claude's context.
  3. Fast: stdlib-only imports, no network, no Semgrep here. Scans are queued
     in SQLite and drained by a detached worker process.
  4. If the DB is locked/broken, spool the raw payload to .vibetrace/spool/
     for the worker to ingest later — never stall the session.

Errors go to .vibetrace/logs/hook-errors.log, nowhere else.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

MAX_STDIN_BYTES = 10 * 1024 * 1024

EVENT_BY_ARG = {
    "session-start": "SessionStart",
    "user-prompt-submit": "UserPromptSubmit",
    "pre-tool-use": "PreToolUse",
    "post-tool-use": "PostToolUse",
    "stop": "Stop",
    "session-end": "SessionEnd",
}

# Events after which queued scans may exist and the worker should be running.
WORKER_KICK_EVENTS = {"PostToolUse", "Stop", "SessionEnd"}


def _log_error(vt_dir: Path, message: str) -> None:
    try:
        log_dir = vt_dir / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        with open(log_dir / "hook-errors.log", "a", encoding="utf-8") as fh:
            fh.write(f"{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())} {message}\n")
    except OSError:
        pass


def _spool(vt_dir: Path, raw: str) -> None:
    try:
        spool = vt_dir / "spool"
        spool.mkdir(parents=True, exist_ok=True)
        name = f"{time.time_ns()}-{os.getpid()}.json"
        (spool / name).write_text(raw, encoding="utf-8")
    except OSError:
        pass


def _kick_worker(project_dir: Path) -> None:
    """Start the detached scan worker if not already running (lockfile-guarded
    inside the worker itself; double-starts are harmless)."""
    if os.environ.get("VIBETRACE_NO_WORKER"):
        return
    try:
        subprocess.Popen(
            [sys.executable, "-m", "vibetrace.scanner.worker", str(project_dir)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
            close_fds=True,
        )
    except OSError:
        pass


def _run(event_arg: str) -> None:
    from vibetrace import capture, config

    raw = sys.stdin.read(MAX_STDIN_BYTES)
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        return
    event = EVENT_BY_ARG.get(event_arg) or payload.get("hook_event_name")
    payload.setdefault("hook_event_name", event)

    project_dir = config.find_project_dir(payload.get("cwd"))
    if not config.is_initialized(project_dir):
        return  # not a vibetrace-tracked project; do nothing
    vt_dir = config.vibetrace_dir(project_dir)
    cfg = config.load_config(project_dir)

    try:
        from vibetrace import db

        conn = db.connect(config.db_path(project_dir))
        try:
            capture.dispatch_event(conn, payload, project_dir, cfg["max_blob_bytes"])
        finally:
            conn.close()
    except Exception as exc:  # DB locked/corrupt/etc: preserve the raw payload
        _log_error(vt_dir, f"{event_arg}: {type(exc).__name__}: {exc}; payload spooled")
        _spool(vt_dir, raw)

    if event in WORKER_KICK_EVENTS:
        _kick_worker(project_dir)


def main() -> int:
    try:
        # Re-point stdout at /dev/null so no accidental print can ever inject
        # context into the Claude session (contract rule 2).
        try:
            sys.stdout = open(os.devnull, "w", encoding="utf-8")
        except OSError:
            pass
        event_arg = sys.argv[1] if len(sys.argv) > 1 else ""
        _run(event_arg)
    except BaseException as exc:  # noqa: BLE001 — contract rule 1: never fail the session
        try:
            from vibetrace import config

            _log_error(
                config.vibetrace_dir(config.find_project_dir(None)),
                f"fatal in main({sys.argv[1:]}): {type(exc).__name__}: {exc}",
            )
        except BaseException:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
