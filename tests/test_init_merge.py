import json

from vibetrace.initproject import (
    HOOK_SPECS,
    install_hooks,
    merge_hooks,
    ensure_gitignore,
)


def _commands(settings):
    return [
        h["command"]
        for groups in settings.get("hooks", {}).values()
        for g in groups
        for h in g.get("hooks", [])
    ]


def test_merge_into_empty_settings():
    merged = merge_hooks({}, python_exe="/venv/bin/python")
    assert set(merged["hooks"]) == {e for e, *_ in HOOK_SPECS}
    for cmd in _commands(merged):
        assert cmd.startswith('"/venv/bin/python" -m vibetrace.hook ')
    post = merged["hooks"]["PostToolUse"][0]
    assert post["matcher"] == "Edit|Write|MultiEdit|NotebookEdit"
    assert "matcher" not in merged["hooks"]["UserPromptSubmit"][0]


def test_merge_preserves_foreign_hooks():
    existing = {
        "permissions": {"allow": ["Bash(ls:*)"]},
        "hooks": {
            "PostToolUse": [
                {"matcher": "Bash", "hooks": [{"type": "command", "command": "my-linter.sh"}]}
            ]
        },
    }
    merged = merge_hooks(existing, python_exe="/py")
    assert merged["permissions"] == {"allow": ["Bash(ls:*)"]}
    post_cmds = [
        h["command"] for g in merged["hooks"]["PostToolUse"] for h in g["hooks"]
    ]
    assert "my-linter.sh" in post_cmds
    assert any("vibetrace.hook post-tool-use" in c for c in post_cmds)


def test_merge_is_idempotent_and_updates_interpreter():
    once = merge_hooks({}, python_exe="/old/python")
    twice = merge_hooks(once, python_exe="/new/python")
    # no duplicates: same number of vibetrace hooks as a fresh install
    fresh = merge_hooks({}, python_exe="/new/python")
    assert _commands(twice) == _commands(fresh)
    assert all("/old/python" not in c for c in _commands(twice))


def test_install_hooks_writes_file_and_reinstall_is_stable(tmp_path):
    p1 = install_hooks(tmp_path, python_exe="/py")
    first = p1.read_text()
    p2 = install_hooks(tmp_path, python_exe="/py")
    assert p1 == p2 == tmp_path / ".claude" / "settings.json"
    assert p2.read_text() == first
    assert json.loads(first)["hooks"]


def test_install_hooks_local_flag(tmp_path):
    p = install_hooks(tmp_path, local=True, python_exe="/py")
    assert p.name == "settings.local.json"


def test_ensure_gitignore(tmp_path):
    (tmp_path / ".gitignore").write_text("node_modules/\n")
    ensure_gitignore(tmp_path)
    ensure_gitignore(tmp_path)  # idempotent
    content = (tmp_path / ".gitignore").read_text()
    assert content.count(".vibetrace/") == 1
    assert content.startswith("node_modules/")
