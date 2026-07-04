"""vibetrace command-line interface."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from vibetrace import __version__, config, db
from vibetrace import initproject


def _project_dir(args) -> Path:
    return Path(args.project).resolve() if args.project else Path.cwd()


def cmd_init(args) -> int:
    project = _project_dir(args)
    vt = config.ensure_dirs(project)
    cfg_path = vt / "config.json"
    if not cfg_path.exists():
        cfg_path.write_text(json.dumps(config.DEFAULTS, indent=2) + "\n", encoding="utf-8")
    db.connect(config.db_path(project)).close()
    initproject.ensure_gitignore(project)
    settings_path = initproject.install_hooks(project, local=args.local)
    print(f"vibetrace initialized in {project}")
    print(f"  hooks registered in {settings_path}")
    print(f"  data will be collected in {vt}")
    print("Start a Claude Code session in this project; verify with /hooks, then")
    print("run `vibetrace dashboard` here to browse captured data.")
    if shutil.which("semgrep") is None and not _venv_semgrep():
        print("WARNING: semgrep not found on PATH — scans will fail. Run `vibetrace doctor`.")
    return 0


def _venv_semgrep() -> str | None:
    """semgrep installed alongside this interpreter (typical venv install)."""
    candidate = Path(sys.executable).parent / "semgrep"
    return str(candidate) if candidate.exists() else None


def cmd_status(args) -> int:
    project = _project_dir(args)
    if not config.is_initialized(project):
        print(f"not initialized: {project} (run `vibetrace init`)")
        return 1
    conn = db.connect(config.db_path(project))
    counts = {
        table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in ("sessions", "prompts", "code_changes")
    }
    # count findings on after-scans only (before-scans are attribution references)
    counts["findings"] = conn.execute(
        "SELECT COUNT(*) FROM findings f JOIN scans s ON s.id=f.scan_id WHERE s.target='after'"
    ).fetchone()[0]
    queued = conn.execute("SELECT COUNT(*) FROM scans WHERE status='queued'").fetchone()[0]
    new_findings = conn.execute("SELECT COUNT(*) FROM findings WHERE is_new=1").fetchone()[0]
    conn.close()
    print(f"vibetrace @ {project}")
    for k, v in counts.items():
        print(f"  {k}: {v}")
    print(f"  new findings (attributed to changes): {new_findings}")
    print(f"  scans pending: {queued}")
    if queued:
        print("  run `vibetrace scan --drain` to process pending scans now")
    return 0


def cmd_doctor(args) -> int:
    project = _project_dir(args)
    ok = True
    print(f"python: {sys.version.split()[0]} ({sys.executable})")
    semgrep = _venv_semgrep() or shutil.which("semgrep")
    if semgrep:
        try:
            out = subprocess.run(
                [semgrep, "--version"], capture_output=True, text=True, timeout=60
            )
            print(f"semgrep: {out.stdout.strip() or out.stderr.strip()} ({semgrep})")
        except (OSError, subprocess.TimeoutExpired) as exc:
            print(f"semgrep: FOUND but failed to run: {exc}")
            ok = False
    else:
        print("semgrep: NOT FOUND — install with `pip install semgrep`")
        ok = False
    if config.is_initialized(project):
        print(f"project: initialized ({config.vibetrace_dir(project)})")
        settings = project / ".claude" / "settings.json"
        local = project / ".claude" / "settings.local.json"
        registered = any(
            p.exists() and initproject.VIBETRACE_MARKER in p.read_text(encoding="utf-8")
            for p in (settings, local)
        )
        print(f"hooks: {'registered' if registered else 'NOT REGISTERED — run `vibetrace init`'}")
        ok = ok and registered
        err_log = config.vibetrace_dir(project) / "logs" / "hook-errors.log"
        if err_log.exists() and err_log.stat().st_size:
            print(f"note: hook errors logged in {err_log}")
    else:
        print(f"project: not initialized ({project}) — run `vibetrace init`")
    return 0 if ok else 1


def cmd_scan(args) -> int:
    project = _project_dir(args)
    if not config.is_initialized(project):
        print(f"not initialized: {project}", file=sys.stderr)
        return 1
    from vibetrace.scanner import worker

    if args.drain:
        processed = worker.drain(project, verbose=True)
        print(f"processed {processed} scan(s)")
        return 0
    worker.spawn_detached(project)
    print("background worker started")
    return 0


def cmd_export(args) -> int:
    project = _project_dir(args)
    if not config.is_initialized(project):
        print(f"not initialized: {project}", file=sys.stderr)
        return 1
    from vibetrace import export

    out_dir = Path(args.out).resolve()
    written = export.export_all(config.db_path(project), out_dir)
    conn = db.connect(config.db_path(project))
    queued = conn.execute("SELECT COUNT(*) FROM scans WHERE status='queued'").fetchone()[0]
    conn.close()
    if queued:
        print(
            f"WARNING: {queued} scan(s) still pending — security columns are incomplete. "
            "Run `vibetrace scan --drain` first.",
            file=sys.stderr,
        )
    for path in written:
        print(path)
    return 0


def cmd_dashboard(args) -> int:
    project = _project_dir(args)
    if not config.is_initialized(project):
        print(f"not initialized: {project}", file=sys.stderr)
        return 1
    cfg = config.load_config(project)
    from vibetrace.dashboard.app import create_app

    app = create_app(config.db_path(project))
    host = args.host or cfg["dashboard_host"]
    port = args.port or cfg["dashboard_port"]
    print(f"vibetrace dashboard: http://{host}:{port}/")
    app.run(host=host, port=port, debug=False)
    return 0


def cmd_rebuild(args) -> int:
    project = _project_dir(args)
    if not config.is_initialized(project):
        print(f"not initialized: {project}", file=sys.stderr)
        return 1
    from vibetrace import rebuild

    n = rebuild.recompute_features(config.db_path(project))
    print(f"recomputed features for {n} prompt(s) at features_version={_fv()}")
    return 0


def _fv() -> str:
    from vibetrace import FEATURES_VERSION

    return FEATURES_VERSION


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="vibetrace",
        description="Prompt-to-code provenance tracking for AI-assisted coding, "
        "with Semgrep security correlation.",
    )
    parser.add_argument("--version", action="version", version=f"vibetrace {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--project", help="project directory (default: cwd)")

    p = sub.add_parser("init", parents=[common], help="wire hooks into a project and create .vibetrace/")
    p.add_argument("--local", action="store_true", help="write to .claude/settings.local.json instead")
    p.set_defaults(func=cmd_init)

    p = sub.add_parser("status", parents=[common], help="show capture/scan counts")
    p.set_defaults(func=cmd_status)

    p = sub.add_parser("doctor", parents=[common], help="check semgrep, hooks registration, logs")
    p.set_defaults(func=cmd_doctor)

    p = sub.add_parser("scan", parents=[common], help="process queued security scans")
    p.add_argument("--drain", action="store_true", help="run synchronously until the queue is empty")
    p.set_defaults(func=cmd_scan)

    p = sub.add_parser("export", parents=[common], help="write research CSVs + JSON dump")
    p.add_argument("--out", required=True, help="output directory")
    p.set_defaults(func=cmd_export)

    p = sub.add_parser("dashboard", parents=[common], help="serve the local dashboard")
    p.add_argument("--host")
    p.add_argument("--port", type=int)
    p.set_defaults(func=cmd_dashboard)

    p = sub.add_parser("rebuild", parents=[common],
                       help="recompute prompt feature columns with the current extractors")
    p.set_defaults(func=cmd_rebuild)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
