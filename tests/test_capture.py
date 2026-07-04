import json
import os
import subprocess
import sys

import pytest

from vibetrace import capture, db


@pytest.fixture()
def project(tmp_path):
    (tmp_path / ".vibetrace" / "spool").mkdir(parents=True)
    (tmp_path / ".vibetrace" / "logs").mkdir(parents=True)
    return tmp_path


@pytest.fixture()
def conn(project):
    c = db.connect(project / ".vibetrace" / "trace.db")
    yield c
    c.close()


def _payload(event, session="s1", **extra):
    base = {
        "session_id": session,
        "hook_event_name": event,
        "transcript_path": "/tmp/transcript.jsonl",
        "cwd": "/tmp/project",
        "permission_mode": "default",
    }
    base.update(extra)
    return base


def test_session_start_creates_session(conn, project):
    capture.handle_session_start(conn, _payload("SessionStart", source="startup"), project)
    row = conn.execute("SELECT * FROM sessions WHERE id='s1'").fetchone()
    assert row["start_source"] == "startup"
    assert conn.execute("SELECT COUNT(*) FROM raw_events").fetchone()[0] == 1


def test_prompt_capture_with_features(conn, project):
    pid = capture.handle_user_prompt_submit(
        conn, _payload("UserPromptSubmit", prompt="just make a quick login page"), project
    )
    row = conn.execute("SELECT * FROM prompts WHERE id=?", (pid,)).fetchone()
    assert row["seq"] == 1
    assert row["feat_urgency_shortcut"] == 1
    assert row["feat_mentions_security"] == 0
    assert json.loads(row["features_json"])["word_count"] == row["feat_word_count"]


def test_prompt_seq_increments(conn, project):
    for text in ("first", "second", "third"):
        capture.handle_user_prompt_submit(
            conn, _payload("UserPromptSubmit", prompt=text), project
        )
    seqs = [r["seq"] for r in conn.execute("SELECT seq FROM prompts ORDER BY id")]
    assert seqs == [1, 2, 3]


def test_edit_existing_file_links_before_after_and_queues_two_scans(conn, project):
    target = project / "app.py"
    target.write_text("print('v1')\n")
    capture.handle_user_prompt_submit(
        conn, _payload("UserPromptSubmit", prompt="change it"), project
    )
    capture.handle_pre_tool_use(
        conn,
        _payload("PreToolUse", tool_name="Edit", tool_input={"file_path": str(target)}),
        project, 1_000_000,
    )
    target.write_text("print('v2')\n")  # simulate the edit having happened
    change_id = capture.handle_post_tool_use(
        conn,
        _payload("PostToolUse", tool_name="Edit",
                 tool_input={"file_path": str(target), "old_string": "v1", "new_string": "v2"},
                 tool_response={}),
        project, 1_000_000,
    )
    change = conn.execute("SELECT * FROM code_changes WHERE id=?", (change_id,)).fetchone()
    assert change["before_sha256"] is not None
    assert change["after_sha256"] is not None
    assert change["before_sha256"] != change["after_sha256"]
    assert change["prompt_id"] is not None  # recency fallback
    scans = conn.execute(
        "SELECT target FROM scans WHERE code_change_id=? ORDER BY target", (change_id,)
    ).fetchall()
    assert [s["target"] for s in scans] == ["after", "before"]
    # blobs round-trip
    assert capture.load_blob(conn, change["after_sha256"]) == b"print('v2')\n"


def test_new_file_gets_null_before_and_one_scan(conn, project):
    target = project / "new.py"
    capture.handle_pre_tool_use(
        conn,
        _payload("PreToolUse", tool_name="Write", tool_input={"file_path": str(target)}),
        project, 1_000_000,
    )
    snap = conn.execute("SELECT sha256 FROM file_snapshots").fetchone()
    assert snap["sha256"] is None  # confirmed absent
    target.write_text("x = 1\n")
    change_id = capture.handle_post_tool_use(
        conn,
        _payload("PostToolUse", tool_name="Write",
                 tool_input={"file_path": str(target), "content": "x = 1\n"},
                 tool_response={}),
        project, 1_000_000,
    )
    change = conn.execute("SELECT * FROM code_changes WHERE id=?", (change_id,)).fetchone()
    assert change["before_sha256"] is None
    targets = [r["target"] for r in conn.execute(
        "SELECT target FROM scans WHERE code_change_id=?", (change_id,))]
    assert targets == ["after"]


def test_prompt_uuid_exact_attribution_beats_recency(conn, project):
    p1 = capture.handle_user_prompt_submit(
        conn, _payload("UserPromptSubmit", prompt="older prompt", prompt_id="uuid-1"), project
    )
    capture.handle_user_prompt_submit(
        conn, _payload("UserPromptSubmit", prompt="newer prompt", prompt_id="uuid-2"), project
    )
    target = project / "f.py"
    target.write_text("pass\n")
    change_id = capture.handle_post_tool_use(
        conn,
        _payload("PostToolUse", tool_name="Write", prompt_id="uuid-1",
                 tool_input={"file_path": str(target)}, tool_response={}),
        project, 1_000_000,
    )
    change = conn.execute("SELECT prompt_id FROM code_changes WHERE id=?", (change_id,)).fetchone()
    assert change["prompt_id"] == p1


def test_notebook_path_supported(conn, project):
    nb = project / "n.ipynb"
    nb.write_text("{}")
    change_id = capture.handle_post_tool_use(
        conn,
        _payload("PostToolUse", tool_name="NotebookEdit",
                 tool_input={"notebook_path": str(nb)}, tool_response={}),
        project, 1_000_000,
    )
    row = conn.execute("SELECT file_path FROM code_changes WHERE id=?", (change_id,)).fetchone()
    assert row["file_path"] == str(nb)


def test_oversized_blob_keeps_hash_drops_content(conn, project):
    digest = capture.store_blob(conn, b"x" * 100, max_bytes=10)
    row = conn.execute("SELECT * FROM blobs WHERE sha256=?", (digest,)).fetchone()
    assert row["size_bytes"] == 100
    assert row["content"] is None
    assert capture.load_blob(conn, digest) is None


# --- hook process contract ---------------------------------------------------

def _run_hook(event, stdin_text, project_dir):
    env = dict(os.environ, CLAUDE_PROJECT_DIR=str(project_dir), VIBETRACE_NO_WORKER="1")
    return subprocess.run(
        [sys.executable, "-m", "vibetrace.hook", event],
        input=stdin_text, capture_output=True, text=True, env=env, timeout=30,
    )


def test_hook_garbage_stdin_exits_zero_no_stdout(project):
    res = _run_hook("user-prompt-submit", "this is not json {", project)
    assert res.returncode == 0
    assert res.stdout == ""


def test_hook_uninitialized_project_is_noop(tmp_path):
    res = _run_hook("user-prompt-submit", json.dumps(_payload("UserPromptSubmit", prompt="hi")), tmp_path)
    assert res.returncode == 0
    assert res.stdout == ""
    assert not (tmp_path / ".vibetrace").exists()


def test_hook_end_to_end_writes_prompt_row(project):
    payload = _payload("UserPromptSubmit", prompt="add input validation to the form")
    res = _run_hook("user-prompt-submit", json.dumps(payload), project)
    assert res.returncode == 0
    assert res.stdout == ""
    conn = db.connect(project / ".vibetrace" / "trace.db")
    row = conn.execute("SELECT * FROM prompts").fetchone()
    assert row["prompt_text"] == "add input validation to the form"
    assert row["feat_starts_imperative"] == 1
    conn.close()
