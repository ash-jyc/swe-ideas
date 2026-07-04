"""Deterministic prompt feature extraction. Stdlib-only, pure functions.

Every feature is reproducible from prompt text alone — no LLM calls, no
randomness, no external state. FEATURES_VERSION (in vibetrace/__init__.py)
must be bumped whenever any definition here changes, so datasets can be
regenerated with `vibetrace rebuild`.

Keyword features are matched case-insensitively on the prompt with fenced
code blocks removed, so pasted code doesn't pollute the counts. Size and
code-presence features use the full prompt.
"""

from __future__ import annotations

import re

FENCE_RE = re.compile(r"```.*?(?:```|$)", re.DOTALL)
INLINE_CODE_RE = re.compile(r"`[^`\n]+`")
WORD_RE = re.compile(r"\b[\w']+\b")
# Path-like tokens: dir/file segments, or bare filenames with a known code extension.
PATH_RE = re.compile(
    r"(?:[\w.~-]+/[\w./-]+)"
    r"|(?:\b[\w-]+\.(?:py|js|jsx|ts|tsx|java|go|rb|php|c|cc|cpp|h|hpp|cs|kt|swift|rs|scala|sh|yaml|yml|json|toml|md|html|css|sql|tf)\b)"
)
# Code identifiers: snake_case, camelCase, or call syntax name().
IDENTIFIER_RE = re.compile(r"\b[a-z]+_[a-z_]\w*\b|\b[a-z]+[A-Z]\w*\b|\b\w+\(\)")
NUMBER_RE = re.compile(r"\b\d+\b")

QUESTION_STARTERS = {
    "how", "what", "why", "where", "when", "which", "who",
    "can", "could", "should", "would", "is", "are", "do", "does", "did",
}
IMPERATIVE_VERBS = {
    "add", "fix", "create", "implement", "write", "refactor", "update",
    "remove", "make", "change", "build", "delete", "rename", "move",
    "convert", "extract", "replace", "generate", "improve", "optimize",
    "clean", "set", "use", "install", "run", "debug", "handle", "test",
    "document", "merge", "split", "wire", "hook", "integrate",
}
SECURITY_TERMS = re.compile(
    r"\b(secur\w*|vulnerab\w*|sanitiz\w*|escap\w*|injection|xss|csrf|"
    r"auth\w*|password|token|encrypt\w*|decrypt\w*|hash\w*|validat\w*|permission\w*|"
    r"secret\w*|credential\w*|exploit\w*|owasp|cwe)\b",
    re.IGNORECASE,
)
TESTING_TERMS = re.compile(
    r"\b(tests?|testing|unit ?tests?|pytest|jest|coverage|tdd|asserts?|mocks?)\b",
    re.IGNORECASE,
)
ERROR_TERMS = re.compile(
    r"\b(errors?|exceptions?|handle|handling|try|catch|edge cases?|fail\w*|crash\w*|"
    r"timeout\w*|retry|retries)\b",
    re.IGNORECASE,
)
VAGUE_TERMS = re.compile(
    r"\b(something|stuff|somehow|whatever|etc|maybe|probably|nice|nicer|better|"
    r"fancy|cool|pretty)\b|clean (?:it )?up|make it work|you know",
    re.IGNORECASE,
)
CONSTRAINT_TERMS = re.compile(
    r"\b(must|should|always|never|only|exactly|at least|at most|no more than|"
    r"ensure|require[ds]?)\b",
    re.IGNORECASE,
)
POLITENESS_TERMS = re.compile(
    r"\b(please|thanks|thank you)\b|could you|would you|can you",
    re.IGNORECASE,
)
URGENCY_TERMS = re.compile(
    r"\b(quick|quickly|asap|just|simply|fast|real quick|hurry)\b",
    re.IGNORECASE,
)
NEGATION_TERMS = re.compile(
    r"\b(don'?t|do not|avoid|never|without|no|not|stop)\b",
    re.IGNORECASE,
)
CONTINUATION_STARTERS = {"also", "now", "then", "next", "instead", "again", "ok", "okay", "and"}
CONTINUATION_PHRASES = re.compile(
    r"as before|like before|same as|like you did|the previous|that last",
    re.IGNORECASE,
)

FEATURE_NAMES = [
    "char_len", "word_count", "line_count",
    "is_question", "starts_imperative",
    "has_code_block", "inline_code_count",
    "path_mention_count", "identifier_count",
    "mentions_security", "mentions_testing", "mentions_error_handling",
    "vague_term_count", "constraint_count",
    "politeness", "urgency_shortcut",
    "negation_count", "references_previous",
    "specificity_score",
]


def strip_code_blocks(prompt: str) -> str:
    return FENCE_RE.sub(" ", prompt)


def _first_token(text: str) -> str:
    m = WORD_RE.search(text)
    return m.group(0).lower() if m else ""


def char_len(prompt: str) -> int:
    return len(prompt)


def word_count(prompt: str) -> int:
    return len(WORD_RE.findall(prompt))


def line_count(prompt: str) -> int:
    return len(prompt.splitlines()) or (1 if prompt else 0)


def is_question(prompt: str) -> int:
    stripped = strip_code_blocks(prompt).strip()
    if stripped.endswith("?"):
        return 1
    return int(_first_token(stripped) in QUESTION_STARTERS)


def starts_imperative(prompt: str) -> int:
    return int(_first_token(strip_code_blocks(prompt)) in IMPERATIVE_VERBS)


def has_code_block(prompt: str) -> int:
    return int("```" in prompt)


def inline_code_count(prompt: str) -> int:
    return len(INLINE_CODE_RE.findall(strip_code_blocks(prompt)))


def path_mention_count(prompt: str) -> int:
    return len(PATH_RE.findall(strip_code_blocks(prompt)))


def identifier_count(prompt: str) -> int:
    return len(IDENTIFIER_RE.findall(strip_code_blocks(prompt)))


def mentions_security(prompt: str) -> int:
    return int(bool(SECURITY_TERMS.search(strip_code_blocks(prompt))))


def mentions_testing(prompt: str) -> int:
    return int(bool(TESTING_TERMS.search(strip_code_blocks(prompt))))


def mentions_error_handling(prompt: str) -> int:
    return int(bool(ERROR_TERMS.search(strip_code_blocks(prompt))))


def vague_term_count(prompt: str) -> int:
    return len(VAGUE_TERMS.findall(strip_code_blocks(prompt)))


def constraint_count(prompt: str) -> int:
    text = strip_code_blocks(prompt)
    return len(CONSTRAINT_TERMS.findall(text)) + len(NUMBER_RE.findall(text))


def politeness(prompt: str) -> int:
    return int(bool(POLITENESS_TERMS.search(strip_code_blocks(prompt))))


def urgency_shortcut(prompt: str) -> int:
    return int(bool(URGENCY_TERMS.search(strip_code_blocks(prompt))))


def negation_count(prompt: str) -> int:
    return len(NEGATION_TERMS.findall(strip_code_blocks(prompt)))


def references_previous(prompt: str) -> int:
    stripped = strip_code_blocks(prompt)
    if _first_token(stripped) in CONTINUATION_STARTERS:
        return 1
    return int(bool(CONTINUATION_PHRASES.search(stripped)))


def specificity_score(prompt: str) -> float:
    """Weighted, length-normalized proxy for how concretely the prompt pins down
    the change: paths and identifiers weigh most, then inline code and
    explicit constraints. Normalized per 100 words, capped at 10.0.

        raw = 3*paths + 2*identifiers + 2*inline_code + 1*constraints
        score = min(10, raw / max(word_count, 20) * 100 / 10)
    """
    words = max(word_count(prompt), 20)
    raw = (
        3 * path_mention_count(prompt)
        + 2 * identifier_count(prompt)
        + 2 * inline_code_count(prompt)
        + 1 * constraint_count(prompt)
    )
    return round(min(10.0, raw / words * 10), 3)


def extract_features(prompt: str) -> dict[str, int | float]:
    """All features for one prompt, keyed by FEATURE_NAMES."""
    return {name: globals()[name](prompt) for name in FEATURE_NAMES}
