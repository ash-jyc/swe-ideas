"""Semgrep invocation and JSON parsing.

parse_semgrep_json() is a pure function tested against captured fixture
output. run_semgrep() shells out to the semgrep CLI; tests can substitute a
fixture via the VIBETRACE_FAKE_SEMGREP env var (path to a semgrep --json file)
so the pipeline is testable without semgrep installed.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Finding:
    rule_id: str
    severity: str | None
    cwe: list[str]
    owasp: list[str]
    confidence: str | None
    message: str | None
    start_line: int | None
    end_line: int | None
    start_col: int | None
    end_col: int | None
    snippet: str | None


@dataclass
class ScanResult:
    findings: list[Finding]
    exit_code: int
    semgrep_version: str
    errors: str | None  # summarized semgrep-reported errors, if any


def semgrep_executable() -> str | None:
    """Prefer semgrep installed alongside this interpreter (venv), else PATH."""
    candidate = Path(sys.executable).parent / "semgrep"
    if candidate.exists():
        return str(candidate)
    return shutil.which("semgrep")


def _semgrep_env() -> dict:
    """Environment for semgrep subprocesses: suppress the update check, which
    stalls for its full network timeout on offline/proxied machines."""
    env = dict(os.environ)
    env.setdefault("SEMGREP_ENABLE_VERSION_CHECK", "0")
    return env


def _as_list(value) -> list[str]:
    """semgrep metadata fields (cwe, owasp) may be a string or a list."""
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(v) for v in value]
    return [str(value)]


def parse_semgrep_json(text: str) -> tuple[list[Finding], str | None]:
    """Parse `semgrep --json` output -> (findings, error summary)."""
    doc = json.loads(text)
    findings = []
    for res in doc.get("results", []):
        extra = res.get("extra", {})
        meta = extra.get("metadata", {})
        findings.append(
            Finding(
                rule_id=res.get("check_id", "unknown"),
                severity=extra.get("severity"),
                cwe=_as_list(meta.get("cwe")),
                owasp=_as_list(meta.get("owasp")),
                confidence=meta.get("confidence"),
                message=extra.get("message"),
                start_line=(res.get("start") or {}).get("line"),
                end_line=(res.get("end") or {}).get("line"),
                start_col=(res.get("start") or {}).get("col"),
                end_col=(res.get("end") or {}).get("col"),
                snippet=extra.get("lines"),
            )
        )
    errors = doc.get("errors") or []
    error_summary = None
    if errors:
        parts = [str(e.get("message", e))[:200] for e in errors[:5]]
        error_summary = f"{len(errors)} semgrep error(s): " + " | ".join(parts)
    return findings, error_summary


def run_semgrep(target_file: Path, rules_config: str, timeout_s: int = 120) -> ScanResult:
    """Scan one file. Exit codes 0/1 both carry parseable JSON (1 = findings
    with --error); >=2 means semgrep itself failed."""
    fake = os.environ.get("VIBETRACE_FAKE_SEMGREP")
    if fake:
        findings, errors = parse_semgrep_json(Path(fake).read_text(encoding="utf-8"))
        return ScanResult(findings, 0, "fake", errors)

    exe = semgrep_executable()
    if exe is None:
        raise FileNotFoundError("semgrep executable not found (pip install semgrep)")
    proc = subprocess.run(
        [
            exe, "scan",
            "--config", rules_config,
            "--json",
            "--metrics=off",
            "--quiet",
            "--disable-version-check",  # avoids a network stall on offline/proxied machines
            "--timeout", "30",
            "--max-target-bytes", "2000000",
            str(target_file),
        ],
        capture_output=True,
        text=True,
        timeout=timeout_s,
        env=_semgrep_env(),
    )
    if proc.returncode >= 2 or not proc.stdout.strip():
        raise RuntimeError(
            f"semgrep exit {proc.returncode}: {(proc.stderr or proc.stdout)[:500]}"
        )
    findings, errors = parse_semgrep_json(proc.stdout)
    return ScanResult(findings, proc.returncode, semgrep_version(exe), errors)


_VERSION_CACHE: dict[str, str] = {}


def semgrep_version(exe: str) -> str:
    if exe not in _VERSION_CACHE:
        try:
            out = subprocess.run(
                [exe, "--version"], capture_output=True, text=True, timeout=60,
                env=_semgrep_env(),
            )
            _VERSION_CACHE[exe] = out.stdout.strip().splitlines()[-1] if out.stdout else "unknown"
        except (OSError, subprocess.TimeoutExpired):
            _VERSION_CACHE[exe] = "unknown"
    return _VERSION_CACHE[exe]
