"""Hook payload -> DB rows. Stdlib-only; shared by hook.py, the worker's
spool ingestion, and `vibetrace rebuild`.

Every handler takes (conn, payload, project_dir) and is idempotent-ish per
event: raw_events always gets a row; derived tables get their projection.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
import zlib
from pathlib import Path

from vibetrace import FEATURES_VERSION
from vibetrace.db import utcnow
from vibetrace.features import extract_features

EDIT_TOOLS = {"Edit", "Write", "MultiEdit", "NotebookEdit"}


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def record_raw_event(conn: sqlite3.Connection, payload: dict, ts: str | None = None) -> None:
    conn.execute(
        "INSERT INTO raw_events(ts, hook_event_name, session_id, payload_json) VALUES (?,?,?,?)",
        (
            ts or utcnow(),
            payload.get("hook_event_name"),
            payload.get("session_id"),
            json.dumps(payload, ensure_ascii=False),
        ),
    )


def ensure_session(conn: sqlite3.Connection, payload: dict, project_dir: Path) -> str | None:
    """Upsert the session row; any event may be the first we see for a session
    (e.g. vibetrace was initialized mid-session or the session was resumed)."""
    session_id = payload.get("session_id")
    if not session_id:
        return None
    conn.execute(
        "INSERT INTO sessions(id, project_dir, transcript_path, started_at)"
        " VALUES (?,?,?,?)"
        " ON CONFLICT(id) DO UPDATE SET"
        "  transcript_path = COALESCE(excluded.transcript_path, transcript_path)",
        (session_id, str(project_dir), payload.get("transcript_path"), utcnow()),
    )
    return session_id


def store_blob(conn: sqlite3.Connection, data: bytes, max_bytes: int) -> str:
    """Store zlib-compressed content, deduped by sha256. Oversized files keep
    their hash (identity/caching still works) but drop content."""
    digest = sha256_hex(data)
    content = zlib.compress(data) if len(data) <= max_bytes else None
    conn.execute(
        "INSERT OR IGNORE INTO blobs(sha256, size_bytes, content) VALUES (?,?,?)",
        (digest, len(data), content),
    )
    return digest


def load_blob(conn: sqlite3.Connection, sha256: str) -> bytes | None:
    row = conn.execute("SELECT content FROM blobs WHERE sha256 = ?", (sha256,)).fetchone()
    if row is None or row["content"] is None:
        return None
    return zlib.decompress(row["content"])


def extract_file_path(tool_input: dict) -> str | None:
    """The documented tool_input invariant is 'mirrors the tool's parameters';
    file-editing tools use file_path, NotebookEdit uses notebook_path."""
    if not isinstance(tool_input, dict):
        return None
    return tool_input.get("file_path") or tool_input.get("notebook_path")


# --- event handlers ---------------------------------------------------------


def handle_session_start(conn: sqlite3.Connection, payload: dict, project_dir: Path) -> None:
    record_raw_event(conn, payload)
    session_id = ensure_session(conn, payload, project_dir)
    if session_id:
        conn.execute(
            "UPDATE sessions SET start_source = ?, model = COALESCE(?, model) WHERE id = ?",
            (payload.get("source"), payload.get("model"), session_id),
        )
    conn.commit()


def handle_user_prompt_submit(conn: sqlite3.Connection, payload: dict, project_dir: Path) -> int | None:
    record_raw_event(conn, payload)
    session_id = ensure_session(conn, payload, project_dir)
    prompt_text = payload.get("prompt")
    if not session_id or not isinstance(prompt_text, str):
        conn.commit()
        return None
    seq = conn.execute(
        "SELECT COALESCE(MAX(seq), 0) + 1 FROM prompts WHERE session_id = ?", (session_id,)
    ).fetchone()[0]
    feats = extract_features(prompt_text)
    feat_cols = {f"feat_{k}": v for k, v in feats.items()}
    cols = ["session_id", "seq", "prompt_uuid", "ts", "cwd", "prompt_text",
            "prompt_sha256", "features_version", *feat_cols, "features_json"]
    vals = [session_id, seq, payload.get("prompt_id"), utcnow(), payload.get("cwd"),
            prompt_text, sha256_hex(prompt_text.encode("utf-8")), FEATURES_VERSION,
            *feat_cols.values(), json.dumps(feats)]
    cur = conn.execute(
        f"INSERT INTO prompts({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", vals
    )
    conn.commit()
    return cur.lastrowid


def handle_pre_tool_use(
    conn: sqlite3.Connection, payload: dict, project_dir: Path, max_blob_bytes: int
) -> None:
    """Snapshot the target file's pre-edit content. A row with sha256 NULL means
    the file was confirmed absent (new file) — distinct from no row (unknown)."""
    record_raw_event(conn, payload)
    session_id = ensure_session(conn, payload, project_dir)
    file_path = extract_file_path(payload.get("tool_input") or {})
    if not session_id or not file_path:
        conn.commit()
        return
    digest = None
    try:
        data = Path(file_path).read_bytes()
        digest = store_blob(conn, data, max_blob_bytes)
    except OSError:
        pass  # absent or unreadable -> recorded as new-file snapshot
    conn.execute(
        "INSERT INTO file_snapshots(session_id, file_path, sha256, ts, origin)"
        " VALUES (?,?,?,?, 'pre_tool_use')",
        (session_id, file_path, digest, utcnow()),
    )
    conn.commit()


def _attribute_prompt(conn: sqlite3.Connection, session_id: str, prompt_uuid: str | None) -> int | None:
    """Exact prompt_id (v2.1.196+) match first; else most recent prompt in session."""
    if prompt_uuid:
        row = conn.execute(
            "SELECT id FROM prompts WHERE prompt_uuid = ? AND session_id = ?"
            " ORDER BY seq DESC LIMIT 1",
            (prompt_uuid, session_id),
        ).fetchone()
        if row:
            return row["id"]
    row = conn.execute(
        "SELECT id FROM prompts WHERE session_id = ? ORDER BY seq DESC LIMIT 1",
        (session_id,),
    ).fetchone()
    return row["id"] if row else None


def handle_post_tool_use(
    conn: sqlite3.Connection, payload: dict, project_dir: Path, max_blob_bytes: int
) -> int | None:
    """Record the code change and enqueue security scans. Returns code_change id."""
    record_raw_event(conn, payload)
    session_id = ensure_session(conn, payload, project_dir)
    tool_name = payload.get("tool_name") or ""
    tool_input = payload.get("tool_input") or {}
    file_path = extract_file_path(tool_input)
    if not session_id or not file_path:
        conn.commit()
        return None

    # PostToolUse fires after the tool succeeded: the on-disk file is the
    # ground truth for "after" content (immune to tool_input schema drift).
    after_sha = None
    after_size = None
    try:
        data = Path(file_path).read_bytes()
        after_sha = store_blob(conn, data, max_blob_bytes)
        after_size = len(data)
    except OSError:
        pass

    before_row = conn.execute(
        "SELECT sha256 FROM file_snapshots WHERE session_id = ? AND file_path = ?"
        " ORDER BY ts DESC, id DESC LIMIT 1",
        (session_id, file_path),
    ).fetchone()
    before_sha = before_row["sha256"] if before_row else None
    has_snapshot = before_row is not None

    prompt_id = _attribute_prompt(conn, session_id, payload.get("prompt_id"))
    ext = Path(file_path).suffix.lstrip(".").lower() or Path(file_path).name.lower()
    cur = conn.execute(
        "INSERT INTO code_changes(session_id, prompt_id, ts, tool_name, file_path,"
        " file_ext, tool_input_json, before_sha256, after_sha256, after_size_bytes)"
        " VALUES (?,?,?,?,?,?,?,?,?,?)",
        (session_id, prompt_id, utcnow(), tool_name, file_path, ext,
         json.dumps(tool_input, ensure_ascii=False), before_sha, after_sha, after_size),
    )
    change_id = cur.lastrowid

    now = utcnow()
    if after_sha:
        conn.execute(
            "INSERT INTO scans(code_change_id, target, target_sha256, queued_at)"
            " VALUES (?, 'after', ?, ?)",
            (change_id, after_sha, now),
        )
    # A before-scan only makes sense when there was pre-edit content that differs.
    if has_snapshot and before_sha and before_sha != after_sha:
        conn.execute(
            "INSERT INTO scans(code_change_id, target, target_sha256, queued_at)"
            " VALUES (?, 'before', ?, ?)",
            (change_id, before_sha, now),
        )
    conn.commit()
    return change_id


def handle_stop(conn: sqlite3.Connection, payload: dict, project_dir: Path) -> None:
    record_raw_event(conn, payload)
    ensure_session(conn, payload, project_dir)
    conn.commit()


def handle_session_end(conn: sqlite3.Connection, payload: dict, project_dir: Path) -> None:
    record_raw_event(conn, payload)
    session_id = ensure_session(conn, payload, project_dir)
    if session_id:
        conn.execute(
            "UPDATE sessions SET ended_at = ?, end_reason = ? WHERE id = ?",
            (utcnow(), payload.get("source") or payload.get("reason"), session_id),
        )
    conn.commit()


DISPATCH = {
    "SessionStart": handle_session_start,
    "UserPromptSubmit": handle_user_prompt_submit,
    "Stop": handle_stop,
    "SessionEnd": handle_session_end,
}


def dispatch_event(
    conn: sqlite3.Connection, payload: dict, project_dir: Path, max_blob_bytes: int
) -> None:
    """Route a payload by hook_event_name (used by spool ingestion/rebuild)."""
    event = payload.get("hook_event_name")
    if event == "PreToolUse":
        handle_pre_tool_use(conn, payload, project_dir, max_blob_bytes)
    elif event == "PostToolUse":
        handle_post_tool_use(conn, payload, project_dir, max_blob_bytes)
    elif event in DISPATCH:
        DISPATCH[event](conn, payload, project_dir)
    else:
        record_raw_event(conn, payload)
        conn.commit()
