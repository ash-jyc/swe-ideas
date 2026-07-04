"""Worker pipeline tests: drain the scan queue end-to-end.

Real-semgrep tests use the local test ruleset (offline); they are skipped when
the semgrep executable is unavailable.
"""

import json
import shutil
from pathlib import Path

import pytest

from vibetrace import capture, config, db
from vibetrace.scanner import worker
from vibetrace.scanner.semgrep_runner import semgrep_executable

FIXTURES = Path(__file__).parent / "fixtures"
RULES = FIXTURES / "rules" / "vibetrace-test-rules.yaml"

needs_semgrep = pytest.mark.skipif(
    semgrep_executable() is None, reason="semgrep not installed"
)


@pytest.fixture()
def project(tmp_path):
    config.ensure_dirs(tmp_path)
    (tmp_path / ".vibetrace" / "config.json").write_text(
        json.dumps(dict(config.DEFAULTS, rules_config=str(RULES)))
    )
    return tmp_path


def _payload(event, session="s1", **extra):
    return {
        "session_id": session, "hook_event_name": event,
        "transcript_path": "/tmp/t.jsonl", "cwd": "/tmp/p", **extra,
    }


def _capture_write(project, filename="app.py", content=None, snapshot_first=True):
    """Simulate prompt -> PreToolUse -> file write -> PostToolUse."""
    conn = db.connect(config.db_path(project))
    target = project / filename
    capture.handle_user_prompt_submit(
        conn, _payload("UserPromptSubmit", prompt="just make a quick login page"), project
    )
    if snapshot_first:
        capture.handle_pre_tool_use(
            conn, _payload("PreToolUse", tool_name="Write",
                           tool_input={"file_path": str(target)}), project, 1_000_000
        )
    target.write_text(content if content is not None
                      else (FIXTURES / "vulnerable_app.py").read_text())
    change_id = capture.handle_post_tool_use(
        conn, _payload("PostToolUse", tool_name="Write",
                       tool_input={"file_path": str(target)}, tool_response={}),
        project, 1_000_000,
    )
    conn.close()
    return change_id, target


@needs_semgrep
def test_drain_new_vulnerable_file_all_findings_new(project):
    change_id, _ = _capture_write(project)
    processed = worker.drain(project)
    assert processed == 1  # one after-scan (new file: no before-scan)
    conn = db.connect(config.db_path(project))
    scan = conn.execute(
        "SELECT * FROM scans WHERE code_change_id=?", (change_id,)
    ).fetchone()
    assert scan["status"] == "done"
    assert scan["findings_count"] == 4
    assert scan["rules_config"] == str(RULES)
    rows = conn.execute(
        "SELECT rule_id, severity, is_new, snippet, cwe FROM findings WHERE scan_id=?",
        (scan["id"],),
    ).fetchall()
    assert all(r["is_new"] == 1 for r in rows)  # confirmed-new file -> all new
    assert {r["severity"] for r in rows} == {"ERROR", "WARNING"}
    assert all(r["snippet"] and r["snippet"] != "requires login" for r in rows)
    assert all(json.loads(r["cwe"]) for r in rows)
    conn.close()


@needs_semgrep
def test_drain_edit_attributes_only_new_findings(project):
    clean = "def add(a, b):\n    return a + b\n"
    vulnerable = clean + "\ndef run(expr):\n    return eval(expr)\n"
    # first write: clean file
    _capture_write(project, content=clean)
    worker.drain(project)
    # second write: introduces eval()
    conn = db.connect(config.db_path(project))
    target = project / "app.py"
    capture.handle_pre_tool_use(
        conn, _payload("PreToolUse", tool_name="Edit",
                       tool_input={"file_path": str(target)}), project, 1_000_000
    )
    target.write_text(vulnerable)
    change_id = capture.handle_post_tool_use(
        conn, _payload("PostToolUse", tool_name="Edit",
                       tool_input={"file_path": str(target)}, tool_response={}),
        project, 1_000_000,
    )
    conn.close()
    worker.drain(project)
    conn = db.connect(config.db_path(project))
    after_scan = conn.execute(
        "SELECT * FROM scans WHERE code_change_id=? AND target='after'", (change_id,)
    ).fetchone()
    rows = conn.execute(
        "SELECT rule_id, is_new FROM findings WHERE scan_id=?", (after_scan["id"],)
    ).fetchall()
    new_rules = [r["rule_id"] for r in rows if r["is_new"] == 1]
    assert len(new_rules) == 1 and "python-eval" in new_rules[0]
    conn.close()


@needs_semgrep
def test_unchanged_content_marks_findings_preexisting(project):
    content = "def run(expr):\n    return eval(expr)\n"
    _capture_write(project, content=content)
    worker.drain(project)
    # re-write identical content: before == after
    conn = db.connect(config.db_path(project))
    target = project / "app.py"
    capture.handle_pre_tool_use(
        conn, _payload("PreToolUse", tool_name="Write",
                       tool_input={"file_path": str(target)}), project, 1_000_000
    )
    target.write_text(content)
    change_id = capture.handle_post_tool_use(
        conn, _payload("PostToolUse", tool_name="Write",
                       tool_input={"file_path": str(target)}, tool_response={}),
        project, 1_000_000,
    )
    conn.close()
    worker.drain(project)
    conn = db.connect(config.db_path(project))
    rows = conn.execute(
        "SELECT f.is_new FROM findings f JOIN scans s ON s.id=f.scan_id"
        " WHERE s.code_change_id=?", (change_id,),
    ).fetchall()
    assert rows and all(r["is_new"] == 0 for r in rows)
    # identical content was served from scan_cache, not rescanned
    assert conn.execute("SELECT COUNT(*) FROM scan_cache").fetchone()[0] == 1
    conn.close()


def test_unsupported_extension_skipped(project):
    change_id, _ = _capture_write(project, filename="notes.xyz", content="hello")
    processed = worker.drain(project)
    assert processed == 1
    conn = db.connect(config.db_path(project))
    scan = conn.execute("SELECT * FROM scans WHERE code_change_id=?", (change_id,)).fetchone()
    assert scan["status"] == "skipped_unsupported"
    assert scan["findings_count"] == 0
    conn.close()


def test_missing_prompt_still_records_change(project):
    """Edits arriving before any prompt (resumed session) must not break."""
    conn = db.connect(config.db_path(project))
    target = project / "x.py"
    target.write_text("pass\n")
    change_id = capture.handle_post_tool_use(
        conn, _payload("PostToolUse", tool_name="Write",
                       tool_input={"file_path": str(target)}, tool_response={}),
        project, 1_000_000,
    )
    row = conn.execute("SELECT prompt_id FROM code_changes WHERE id=?", (change_id,)).fetchone()
    assert row["prompt_id"] is None
    conn.close()


def test_spool_ingestion(project):
    """Payloads spooled while the DB was unavailable are replayed by the worker."""
    spool = project / ".vibetrace" / "spool"
    payload = _payload("UserPromptSubmit", prompt="spooled prompt")
    (spool / "1-1.json").write_text(json.dumps(payload))
    worker.drain(project)
    conn = db.connect(config.db_path(project))
    row = conn.execute("SELECT prompt_text FROM prompts").fetchone()
    assert row["prompt_text"] == "spooled prompt"
    assert not list(spool.glob("*.json"))
    conn.close()


def test_fake_semgrep_env(project, monkeypatch):
    """VIBETRACE_FAKE_SEMGREP substitutes fixture output: pipeline testable
    without semgrep installed."""
    monkeypatch.setenv("VIBETRACE_FAKE_SEMGREP", str(FIXTURES / "semgrep_output.json"))
    change_id, _ = _capture_write(project)
    worker.drain(project)
    conn = db.connect(config.db_path(project))
    scan = conn.execute("SELECT * FROM scans WHERE code_change_id=?", (change_id,)).fetchone()
    assert scan["status"] == "done"
    assert scan["findings_count"] == 4
    assert scan["semgrep_version"] == "fake"
    conn.close()
