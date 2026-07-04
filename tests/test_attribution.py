from vibetrace.scanner.attribution import fingerprint, hydrate_snippets, mark_new
from vibetrace.scanner.semgrep_runner import Finding


def _finding(rule="r.eval", snippet="return str(eval(expr))", line=10):
    return Finding(
        rule_id=rule, severity="ERROR", cwe=[], owasp=[], confidence=None,
        message=None, start_line=line, end_line=line, start_col=1, end_col=9,
        snippet=snippet,
    )


def test_fingerprint_independent_of_line_numbers():
    assert fingerprint(_finding(line=10)) == fingerprint(_finding(line=99))


def test_fingerprint_whitespace_normalized():
    a = _finding(snippet="x =  eval( expr )")
    b = _finding(snippet="x = eval( expr )\n")
    assert fingerprint(a) == fingerprint(b)


def test_fingerprint_distinguishes_rule_and_code():
    assert fingerprint(_finding(rule="r.a")) != fingerprint(_finding(rule="r.b"))
    assert fingerprint(_finding(snippet="eval(a)")) != fingerprint(_finding(snippet="eval(b)"))


def test_mark_new_against_before_set():
    old = _finding(snippet="eval(old)")
    new = _finding(snippet="eval(new)")
    marked = mark_new([old, new], {fingerprint(old)})
    assert [(f.snippet, is_new) for f, _, is_new in marked] == [
        ("eval(old)", 0), ("eval(new)", 1),
    ]


def test_mark_new_empty_before_means_all_new():
    marked = mark_new([_finding()], set())
    assert marked[0][2] == 1


def test_mark_new_unknown_before_means_null():
    marked = mark_new([_finding()], None)
    assert marked[0][2] is None


def test_hydrate_snippets_extracts_from_content():
    content = "line one\nx = eval(expr)\nline three\n"
    f = _finding(snippet="requires login", line=2)
    hydrate_snippets([f], content)
    assert f.snippet == "x = eval(expr)"


def test_hydrate_snippets_multiline_and_out_of_range():
    content = "a\nb\nc\n"
    multi = _finding(snippet=None, line=1)
    multi.end_line = 2
    beyond = _finding(snippet="requires login", line=50)
    hydrate_snippets([multi, beyond], content)
    assert multi.snippet == "a\nb"
    assert beyond.snippet is None  # redaction cleared, nothing extractable
