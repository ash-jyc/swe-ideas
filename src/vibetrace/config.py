"""Per-project configuration and path resolution. Stdlib-only (hook fast path)."""

from __future__ import annotations

import json
import os
from pathlib import Path

VIBETRACE_DIR_NAME = ".vibetrace"
DB_FILENAME = "trace.db"

# Extensions semgrep can meaningfully scan; anything else is recorded as
# skipped_unsupported so the analysis denominator stays known.
DEFAULT_SCAN_EXTENSIONS = [
    "py", "js", "jsx", "ts", "tsx", "mjs", "cjs", "java", "go", "rb", "php",
    "c", "cc", "cpp", "h", "hpp", "cs", "kt", "kts", "swift", "rs", "scala",
    "sh", "bash", "yaml", "yml", "json", "tf", "html", "sql", "dockerfile",
]

DEFAULTS = {
    "rules_config": "p/security-audit",
    "scan_extensions": DEFAULT_SCAN_EXTENSIONS,
    "max_blob_bytes": 1_000_000,
    "semgrep_timeout_s": 120,
    "worker_idle_exit_s": 60,
    "dashboard_host": "127.0.0.1",
    "dashboard_port": 8321,
}


def find_project_dir(payload_cwd: str | None = None) -> Path:
    """Resolve the project root the hook is running for.

    Claude Code sets CLAUDE_PROJECT_DIR when running hooks; the payload cwd is
    the fallback (it can differ if Claude cd'ed during the session).
    """
    env_dir = os.environ.get("CLAUDE_PROJECT_DIR")
    if env_dir:
        return Path(env_dir)
    if payload_cwd:
        return Path(payload_cwd)
    return Path.cwd()


def vibetrace_dir(project_dir: Path) -> Path:
    return project_dir / VIBETRACE_DIR_NAME


def db_path(project_dir: Path) -> Path:
    override = os.environ.get("VIBETRACE_DB")
    if override:
        return Path(override)
    return vibetrace_dir(project_dir) / DB_FILENAME


def is_initialized(project_dir: Path) -> bool:
    return vibetrace_dir(project_dir).is_dir()


def load_config(project_dir: Path) -> dict:
    """Merged config: defaults overlaid with .vibetrace/config.json if present."""
    cfg = dict(DEFAULTS)
    cfg_file = vibetrace_dir(project_dir) / "config.json"
    try:
        cfg.update(json.loads(cfg_file.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        pass
    return cfg


def ensure_dirs(project_dir: Path) -> Path:
    """Create the .vibetrace layout; returns the .vibetrace dir."""
    vt = vibetrace_dir(project_dir)
    (vt / "spool").mkdir(parents=True, exist_ok=True)
    (vt / "logs").mkdir(parents=True, exist_ok=True)
    return vt
