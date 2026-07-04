"""Finding identity and new-vs-pre-existing attribution.

A finding's fingerprint is sha256(rule_id + "\\0" + whitespace-normalized
snippet): independent of line numbers and file path, so an unrelated edit that
shifts lines does not turn a pre-existing finding into a "new" one. A finding
in the after-scan is NEW iff its fingerprint is absent from the before-scan.
"""

from __future__ import annotations

import hashlib
import re

from vibetrace.scanner.semgrep_runner import Finding

_WS = re.compile(r"\s+")

# Newer semgrep CLIs redact extra.lines to "requires login" for anonymous
# runs, so snippets are always re-extracted from the scanned content itself.
REDACTED = "requires login"


def hydrate_snippets(findings: list[Finding], content_text: str) -> None:
    """Fill each finding's snippet from the exact scanned content (in place).

    Extraction from our own blob is deterministic and independent of semgrep's
    output/redaction policy; extra.lines is kept only as a fallback.
    """
    lines = content_text.splitlines()
    for f in findings:
        if f.start_line is None:
            continue
        start = max(f.start_line - 1, 0)
        end = f.end_line if f.end_line else f.start_line
        extracted = "\n".join(lines[start:end])
        if extracted:
            f.snippet = extracted
        elif f.snippet == REDACTED:
            f.snippet = None


def fingerprint(finding: Finding) -> str:
    normalized = _WS.sub(" ", (finding.snippet or "").strip())
    return hashlib.sha256(f"{finding.rule_id}\0{normalized}".encode("utf-8")).hexdigest()


def mark_new(
    after: list[Finding], before_fingerprints: set[str] | None
) -> list[tuple[Finding, str, int | None]]:
    """Return (finding, fingerprint, is_new) for each after-scan finding.

    before_fingerprints semantics:
      - set (possibly empty): before content was scanned -> definitive 0/1
      - None: prior state unknown (no snapshot / before scan failed) -> is_new NULL
    """
    out = []
    for f in after:
        fp = fingerprint(f)
        if before_fingerprints is None:
            is_new = None
        else:
            is_new = int(fp not in before_fingerprints)
        out.append((f, fp, is_new))
    return out
