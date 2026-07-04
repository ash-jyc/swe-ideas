"""Full offline end-to-end: real hook subprocesses -> SQLite -> scan drain ->
export, without a live Claude Code session. Mirrors scripts/simulate_session.sh
but assertable. Uses real semgrep with the local test ruleset when available,
else the fake-semgrep fixture."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from vibetrace import config, db, export
from vibetrace.scanner.semgrep_runner import semgrep_executable

FIXTURES = Path(__file__).parent / "fixtures"
RULES = FIXTURES / "rules" / "vibetrace-test-rules.yaml"

VULNERABLE = 'import flask\napp = flask.Flask(__name__)\n\n@app.route("/x")\ndef x():\n    return str(eval(flask.request.args.get("e", "1")))\n'
FIXED = 'import flask\napp = flask.Flask(__name__)\n\n@app.route("/x")\ndef x():\n    return "disabled"\n'


def _hook(event, payload, project, env_extra=None):
    env = dict(os.environ, CLAUDE_PROJECT_DIR=str(project), VIBETRACE_NO_WORKER="1",
               **(env_extra or {}))
    res = subprocess.run(
        [sys.executable, "-m", "vibetrace.hook", event],
        input=json.dumps(payload), capture_output=True, text=True, env=env, timeout=60,
    )
    assert res.returncode == 0, res.stderr
    assert res.stdout == ""  # contract: nothing is ever injected into context
    return res


def test_full_pipeline(tmp_path, monkeypatch):
    project = tmp_path
    # init via the CLI exactly as a user would
    from vibetrace.cli import main as cli_main

    monkeypatch.chdir(project)
    assert cli_main(["init"]) == 0
    assert (project / ".claude" / "settings.json").exists()
    assert ".vibetrace/" in (project / ".gitignore").read_text()

    if semgrep_executable() is not None:
        cfg_path = project / ".vibetrace" / "config.json"
        cfg = json.loads(cfg_path.read_text())
        cfg["rules_config"] = str(RULES)
        cfg_path.write_text(json.dumps(cfg))
    else:
        monkeypatch.setenv("VIBETRACE_FAKE_SEMGREP", str(FIXTURES / "semgrep_output.json"))

    def payload(event, **extra):
        return {"session_id": "e2e-1", "hook_event_name": event,
                "transcript_path": "/tmp/t.jsonl", "cwd": str(project),
                "permission_mode": "default", **extra}

    target = project / "app.py"
    _hook("session-start", payload("SessionStart", source="startup"), project)
    _hook("user-prompt-submit",
          payload("UserPromptSubmit", prompt="just make a quick calculator endpoint"), project)
    _hook("pre-tool-use",
          payload("PreToolUse", tool_name="Write", tool_input={"file_path": str(target)}),
          project)
    target.write_text(VULNERABLE)
    _hook("post-tool-use",
          payload("PostToolUse", tool_name="Write",
                  tool_input={"file_path": str(target), "content": VULNERABLE},
                  tool_response={}), project)

    _hook("user-prompt-submit",
          payload("UserPromptSubmit",
                  prompt="Remove the eval() for security, sanitize all input"), project)
    _hook("pre-tool-use",
          payload("PreToolUse", tool_name="Edit", tool_input={"file_path": str(target)}),
          project)
    target.write_text(FIXED)
    _hook("post-tool-use",
          payload("PostToolUse", tool_name="Edit",
                  tool_input={"file_path": str(target)}, tool_response={}), project)
    _hook("stop", payload("Stop"), project)
    _hook("session-end", payload("SessionEnd", source="other"), project)

    # drain scans synchronously
    assert cli_main(["scan", "--drain"]) == 0

    conn = db.connect(config.db_path(project))
    assert conn.execute("SELECT COUNT(*) FROM prompts").fetchone()[0] == 2
    assert conn.execute("SELECT COUNT(*) FROM code_changes").fetchone()[0] == 2
    assert conn.execute(
        "SELECT COUNT(*) FROM scans WHERE status IN ('queued','running')"
    ).fetchone()[0] == 0
    if semgrep_executable() is not None:
        # vague prompt introduced the eval finding; fixing edit introduced none
        rows = conn.execute(
            """SELECT p.seq, COALESCE(SUM(f.is_new = 1), 0) AS n_new
               FROM prompts p
               LEFT JOIN code_changes c ON c.prompt_id = p.id
               LEFT JOIN scans s ON s.code_change_id = c.id AND s.target = 'after'
               LEFT JOIN findings f ON f.scan_id = s.id
               GROUP BY p.id ORDER BY p.seq"""
        ).fetchall()
        assert [(r["seq"], r["n_new"]) for r in rows] == [(1, 1), (2, 0)]

    # export
    out = project / "exp"
    written = export.export_all(config.db_path(project), out)
    assert {p.name for p in written} == {
        "flat.csv", "prompts.csv", "changes.csv", "findings.csv", "dump.json"}
    flat = (out / "flat.csv").read_text().strip().splitlines()
    assert len(flat) == 3
    conn.close()


@pytest.mark.skipif(
    not (Path(__file__).parent.parent / "scripts" / "simulate_session.sh").exists(),
    reason="script missing",
)
def test_simulate_script_runs(tmp_path):
    """The documented demo script must stay green."""
    script = Path(__file__).parent.parent / "scripts" / "simulate_session.sh"
    env = dict(
        os.environ, PYTHON=sys.executable,
        VIBETRACE_RULES=str(RULES) if semgrep_executable() else "",
        VIBETRACE_NO_WORKER="1",
    )
    if semgrep_executable() is None:
        env["VIBETRACE_FAKE_SEMGREP"] = str(FIXTURES / "semgrep_output.json")
    res = subprocess.run(
        ["bash", str(script), str(tmp_path / "demo")],
        capture_output=True, text=True, env=env, timeout=300,
    )
    assert res.returncode == 0, res.stderr + res.stdout
    assert "scans pending: 0" in res.stdout
