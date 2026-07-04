"""Wire vibetrace hooks into a project's .claude/settings.json.

Read-merge-write: foreign hooks are preserved untouched; vibetrace's own
entries (identified by the 'vibetrace.hook' command substring) are replaced,
making `vibetrace init` idempotent and safe to re-run after moving the venv.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

VIBETRACE_MARKER = "vibetrace.hook"
EDIT_TOOL_MATCHER = "Edit|Write|MultiEdit|NotebookEdit"

# (event, matcher-or-None, hook-arg, timeout-seconds). Timeouts are a backstop;
# handlers target <100ms.
HOOK_SPECS = [
    ("SessionStart", None, "session-start", 10),
    ("UserPromptSubmit", None, "user-prompt-submit", 10),
    ("PreToolUse", EDIT_TOOL_MATCHER, "pre-tool-use", 10),
    ("PostToolUse", EDIT_TOOL_MATCHER, "post-tool-use", 15),
    ("Stop", None, "stop", 10),
    ("SessionEnd", None, "session-end", 10),
]


def hook_command(event_arg: str, python_exe: str | None = None) -> str:
    """Absolute interpreter path is embedded so hooks work regardless of the
    PATH Claude Code runs with."""
    exe = python_exe or sys.executable
    return f'"{exe}" -m vibetrace.hook {event_arg}'


def _is_vibetrace_hook(hook: dict) -> bool:
    return VIBETRACE_MARKER in hook.get("command", "")


def _strip_vibetrace(settings: dict) -> None:
    hooks = settings.get("hooks")
    if not isinstance(hooks, dict):
        return
    for event, groups in list(hooks.items()):
        if not isinstance(groups, list):
            continue
        kept_groups = []
        for group in groups:
            if not isinstance(group, dict):
                kept_groups.append(group)
                continue
            group_hooks = [
                h for h in group.get("hooks", [])
                if not (isinstance(h, dict) and _is_vibetrace_hook(h))
            ]
            if group_hooks:
                group = dict(group, hooks=group_hooks)
                kept_groups.append(group)
            # groups left empty after stripping our hooks are dropped
        if kept_groups:
            hooks[event] = kept_groups
        else:
            del hooks[event]
    if not hooks:
        settings.pop("hooks", None)


def merge_hooks(settings: dict, python_exe: str | None = None) -> dict:
    """Return settings with vibetrace hook groups (re)installed."""
    settings = json.loads(json.dumps(settings))  # deep copy
    _strip_vibetrace(settings)
    hooks = settings.setdefault("hooks", {})
    for event, matcher, event_arg, timeout in HOOK_SPECS:
        group: dict = {
            "hooks": [
                {
                    "type": "command",
                    "command": hook_command(event_arg, python_exe),
                    "timeout": timeout,
                }
            ]
        }
        if matcher is not None:
            group["matcher"] = matcher
        hooks.setdefault(event, []).append(group)
    return settings


def install_hooks(project_dir: Path, local: bool = False, python_exe: str | None = None) -> Path:
    """Read-merge-write the project's settings file; returns the path written."""
    claude_dir = project_dir / ".claude"
    claude_dir.mkdir(parents=True, exist_ok=True)
    settings_path = claude_dir / ("settings.local.json" if local else "settings.json")
    settings = {}
    if settings_path.exists():
        text = settings_path.read_text(encoding="utf-8").strip()
        if text:
            settings = json.loads(text)  # malformed settings must fail loudly, not be clobbered
    merged = merge_hooks(settings, python_exe)
    settings_path.write_text(json.dumps(merged, indent=2) + "\n", encoding="utf-8")
    return settings_path


def ensure_gitignore(project_dir: Path) -> None:
    """Append .vibetrace/ to the project .gitignore if not already covered."""
    gi = project_dir / ".gitignore"
    line = ".vibetrace/"
    try:
        existing = gi.read_text(encoding="utf-8") if gi.exists() else ""
    except OSError:
        return
    if any(l.strip() in (line, ".vibetrace") for l in existing.splitlines()):
        return
    sep = "" if (not existing or existing.endswith("\n")) else "\n"
    gi.write_text(existing + sep + line + "\n", encoding="utf-8")
