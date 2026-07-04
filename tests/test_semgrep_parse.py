import json
from pathlib import Path

from vibetrace.scanner.semgrep_runner import parse_semgrep_json

FIXTURE = Path(__file__).parent / "fixtures" / "semgrep_output.json"


def test_parse_real_fixture():
    findings, errors = parse_semgrep_json(FIXTURE.read_text())
    assert len(findings) == 4
    assert errors is None
    by_rule = {f.rule_id.rsplit(".", 1)[-1]: f for f in findings}
    assert by_rule["python-eval"].severity == "ERROR"
    assert by_rule["sql-string-concat"].severity == "WARNING"
    f = by_rule["subprocess-shell-true"]
    assert f.start_line == 26 and f.end_line == 26
    assert f.confidence == "HIGH"
    assert f.owasp == ["A03:2021 - Injection"]


def test_cwe_string_normalized_to_list():
    findings, _ = parse_semgrep_json(FIXTURE.read_text())
    eval_finding = next(f for f in findings if "python-eval" in f.rule_id)
    # fixture rule deliberately declares cwe as a string
    assert isinstance(eval_finding.cwe, list)
    assert eval_finding.cwe and eval_finding.cwe[0].startswith("CWE-95")


def test_parse_empty_results():
    findings, errors = parse_semgrep_json('{"results": [], "errors": []}')
    assert findings == [] and errors is None


def test_parse_errors_summarized():
    doc = {
        "results": [],
        "errors": [
            {"message": "Syntax error at line 3"},
            {"message": "x" * 500},
        ],
    }
    findings, errors = parse_semgrep_json(json.dumps(doc))
    assert findings == []
    assert errors.startswith("2 semgrep error(s):")
    assert "Syntax error" in errors
    assert len(errors) < 600  # messages are truncated


def test_parse_missing_optional_fields():
    doc = {"results": [{"check_id": "r1", "start": {}, "end": {}, "extra": {}}]}
    findings, _ = parse_semgrep_json(json.dumps(doc))
    f = findings[0]
    assert f.rule_id == "r1"
    assert f.severity is None and f.cwe == [] and f.start_line is None
