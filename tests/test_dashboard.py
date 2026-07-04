"""Dashboard route + export tests against a populated database (fake semgrep)."""

import json
from pathlib import Path

import pytest

from vibetrace import capture, config, db, export
from vibetrace.dashboard import queries
from vibetrace.dashboard.app import create_app
from vibetrace.rebuild import recompute_features
from vibetrace.scanner import worker

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture()
def project(tmp_path, monkeypatch):
    """Project with one session: a vague prompt causing a vulnerable write and
    a security-aware prompt causing a clean write."""
    monkeypatch.setenv("VIBETRACE_FAKE_SEMGREP", str(FIXTURES / "semgrep_output.json"))
    config.ensure_dirs(tmp_path)
    conn = db.connect(config.db_path(tmp_path))

    def payload(event, **extra):
        return {"session_id": "sess-1", "hook_event_name": event,
                "transcript_path": "/tmp/t.jsonl", "cwd": str(tmp_path), **extra}

    capture.handle_session_start(conn, payload("SessionStart", source="startup"), tmp_path)

    # prompt 1 (vague) -> vulnerable new file
    capture.handle_user_prompt_submit(
        conn, payload("UserPromptSubmit", prompt="just make a quick login page"), tmp_path)
    target = tmp_path / "app.py"
    capture.handle_pre_tool_use(
        conn, payload("PreToolUse", tool_name="Write",
                      tool_input={"file_path": str(target)}), tmp_path, 1_000_000)
    target.write_text((FIXTURES / "vulnerable_app.py").read_text())
    capture.handle_post_tool_use(
        conn, payload("PostToolUse", tool_name="Write",
                      tool_input={"file_path": str(target)}, tool_response={}),
        tmp_path, 1_000_000)

    # prompt 2 (security-aware) -> clean new file; fake semgrep still reports
    # fixture findings, which is fine for route testing
    capture.handle_user_prompt_submit(
        conn, payload("UserPromptSubmit",
                      prompt="Please securely hash the password in `auth.py`, validate input length"),
        tmp_path)
    conn.close()

    worker.drain(tmp_path)
    return tmp_path


@pytest.fixture()
def client(project):
    app = create_app(config.db_path(project))
    app.testing = True
    return app.test_client()


def test_index_lists_session_and_tiles(client):
    html = client.get("/").get_data(as_text=True)
    assert "sess-1"[:10] in html or "sess-1" in html
    assert "prompts" in html and "new findings" in html


def test_session_timeline_shows_chain(client):
    html = client.get("/session/sess-1").get_data(as_text=True)
    assert "just make a quick login page" in html
    assert "app.py" in html
    assert "NEW" in html  # new-file findings badged as new
    assert "vague" in html  # prompt trait badge


def test_prompt_page_shows_features(client):
    html = client.get("/prompt/1").get_data(as_text=True)
    assert "urgency_shortcut" in html
    assert "just make a quick login page" in html


def test_change_page_shows_findings_and_content(client):
    html = client.get("/change/1").get_data(as_text=True)
    assert "python-eval" in html
    assert "NEW" in html


def test_stats_page_renders_charts_and_table(client):
    html = client.get("/stats").get_data(as_text=True)
    assert "<svg" in html
    assert "Urgency/shortcut wording" in html
    assert "point-biserial" in html


def test_404s(client):
    assert client.get("/session/nope").status_code == 404
    assert client.get("/prompt/999").status_code == 404
    assert client.get("/change/999").status_code == 404


def test_export_flat_csv_route_and_shape(client):
    text = client.get("/export/flat.csv").get_data(as_text=True)
    header = text.splitlines()[0].split(",")
    for col in ("prompt_id", "session_id", "feat_char_len", "feat_mentions_security",
                "feat_vague_term_count", "feat_specificity_score", "n_changes",
                "n_findings_new", "n_new_error", "distinct_new_rules", "n_scans_pending"):
        assert col in header
    rows = text.strip().splitlines()
    assert len(rows) == 3  # header + 2 prompts


def test_flat_csv_outcome_attribution(project):
    conn = db.connect(config.db_path(project))
    outcomes = {o["prompt_id"]: o for o in queries.prompt_outcomes(conn)}
    conn.close()
    assert outcomes[1]["n_findings_new"] == 4  # vague prompt -> vulnerable file
    assert outcomes[1]["n_new_error"] == 2
    assert outcomes[2]["n_changes"] == 0  # security prompt made no changes
    assert outcomes[2]["n_findings_new"] == 0


def test_export_dump_json(client):
    doc = json.loads(client.get("/export/dump.json").get_data(as_text=True))
    assert doc["meta"]["schema_version"]
    assert len(doc["prompts"]) == 2
    assert len(doc["findings"]) == 4
    assert doc["scan_configs"]


def test_export_all_cli_paths(project, tmp_path):
    out = tmp_path / "exp"
    written = export.export_all(config.db_path(project), out)
    names = {p.name for p in written}
    assert names == {"flat.csv", "prompts.csv", "changes.csv", "findings.csv", "dump.json"}
    assert (out / "flat.csv").read_text().startswith("prompt_id,")


def test_rebuild_recomputes_features(project):
    dbp = config.db_path(project)
    conn = db.connect(dbp)
    conn.execute("UPDATE prompts SET feat_word_count = -1")
    conn.commit()
    conn.close()
    n = recompute_features(dbp)
    assert n == 2
    conn = db.connect(dbp)
    assert conn.execute("SELECT MIN(feat_word_count) FROM prompts").fetchone()[0] > 0
    conn.close()


def test_point_biserial_known_value():
    # ones avg 3, zeros avg 1 -> positive correlation
    r = queries.point_biserial([1, 1, 0, 0], [3.0, 3.0, 1.0, 1.0])
    assert r == 1.0
    assert queries.point_biserial([1, 1], [2.0, 2.0]) is None  # no variance / one class
