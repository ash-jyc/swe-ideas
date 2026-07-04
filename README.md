# vibetrace

**Prompt→code provenance tracking for AI-assisted ("vibe") coding, with security correlation.**

vibetrace records what you *prompted* Claude Code, what *code* it generated in
response, and how the *security* of that code changed — linking all three so you
can study questions like *"do vaguer prompts produce more vulnerable code?"* on
real coding sessions.

- **Capture** — [Claude Code hooks](https://code.claude.com/docs/en/hooks) log every
  prompt and every file edit to a local SQLite database. No LLM calls, no cloud,
  nothing leaves your machine.
- **Prompt features** — ~19 deterministic, reproducible heuristics per prompt
  (length, specificity, vagueness, security/testing mentions, imperative vs
  question, …).
- **Security outcomes** — every edit is scanned with [Semgrep](https://semgrep.dev)
  out-of-process; each finding is attributed as **new** (introduced by that edit)
  or pre-existing by diffing before/after scans of the exact file contents.
- **Analysis** — a local dashboard with session timelines and trait↔outcome
  correlations, plus flat CSV / JSON exports for real statistical work.

## Install

```bash
python -m venv .venv && .venv/bin/pip install <path-to-this-repo>
# or: pipx install <path-to-this-repo>
```

Python ≥ 3.10. Runtime dependencies: `flask`, `semgrep`.

## Use

```bash
cd ~/code/my-project        # any project you vibe-code in
vibetrace init              # creates .vibetrace/, registers hooks in .claude/settings.json
vibetrace doctor            # sanity-check semgrep + hook registration
claude                      # code as usual; capture is automatic (verify with /hooks)

vibetrace status            # capture/scan counts
vibetrace scan --drain      # settle any pending scans deterministically
vibetrace dashboard         # browse http://127.0.0.1:8321/
vibetrace export --out data/  # flat.csv, per-table CSVs, dump.json
```

`vibetrace init --local` writes hooks to `.claude/settings.local.json` instead
(not committed). Re-run `init` any time — it is idempotent and preserves any
other hooks you have.

Try it without a live session:

```bash
scripts/simulate_session.sh          # pipes realistic hook payloads end-to-end
```

## How it works

```
Claude Code session                        detached worker             dashboard/export
───────────────────                        ───────────────             ────────────────
UserPromptSubmit ──► prompt + features ─┐
PreToolUse ──────► pre-edit snapshot ───┼──► SQLite (.vibetrace/trace.db)
PostToolUse ─────► change + scan queue ─┘        │ ▲
                    └─ kicks ────────────► semgrep scans (before/after content,
                                           cached by content hash; findings
                                           fingerprinted → is_new attribution)
```

- Hooks are stdlib-only and finish in milliseconds; Semgrep runs in a detached
  worker so scans never add latency to your session.
- Hooks **always exit 0 and never write to stdout** — they cannot block your
  prompt, inject context, or break a session. Errors go to
  `.vibetrace/logs/hook-errors.log`; if the DB is unavailable, payloads are
  spooled to `.vibetrace/spool/` and ingested later.
- An edit is linked to its prompt by the payload `prompt_id` when available
  (Claude Code ≥ 2.1.196), else to the most recent prompt in the session.
- A finding is **new** iff its fingerprint — `sha256(rule_id + whitespace-normalized
  snippet)`, independent of line numbers — is absent from the scan of the file's
  pre-edit content. New files (confirmed absent at PreToolUse time) count all
  findings as new; unknown prior state yields `is_new = NULL`, never a guess.

## Reproducibility

- **Rules**: default `p/security-audit` (fetched from the Semgrep registry on
  first use, then cached). For pinned, fully offline runs, clone
  [semgrep/semgrep-rules](https://github.com/semgrep/semgrep-rules) at a fixed
  commit and set `rules_config` in `.vibetrace/config.json` to a local path.
  Every scan row records the `rules_config` and `semgrep_version` used.
- **Features**: extractors are pure functions versioned by `FEATURES_VERSION`.
  After changing them, run `vibetrace rebuild` to recompute all feature columns
  from the stored prompt text.
- **Raw events**: every hook payload is stored verbatim in `raw_events`, so the
  derived tables can always be re-derived.
- Identical file contents are scanned once (`scan_cache`, keyed by content hash
  + ruleset + semgrep version).

## Data & codebook

`flat.csv` (one row per prompt — the primary research artifact):

| Column | Meaning |
|---|---|
| `prompt_id`, `session_id`, `seq`, `ts`, `prompt_sha256` | Identity/join keys; `seq` is the prompt's ordinal within its session |
| `features_version` | Extractor version that produced the `feat_*` columns |
| `feat_char_len` / `feat_word_count` / `feat_line_count` | Raw prompt size |
| `feat_is_question` | Ends with `?` or starts with an interrogative token |
| `feat_starts_imperative` | First word is an imperative verb (add, fix, create, …) |
| `feat_has_code_block` / `feat_inline_code_count` | ``` fence present / count of `inline code` spans |
| `feat_path_mention_count` | Path-like tokens (`src/x.py`, `auth.py`) |
| `feat_identifier_count` | snake_case / camelCase / `name()` tokens |
| `feat_mentions_security` | Any security vocabulary (auth, password, sanitize, injection, …) |
| `feat_mentions_testing` / `feat_mentions_error_handling` | Testing / error-handling vocabulary |
| `feat_vague_term_count` | Vague wording ("something", "stuff", "make it work", …) |
| `feat_constraint_count` | Constraint words (must, never, only, …) + numeric literals |
| `feat_politeness` | please / could you / thanks |
| `feat_urgency_shortcut` | just / quick / asap / simply |
| `feat_negation_count` | don't / avoid / never / without / no |
| `feat_references_previous` | Continuation of an earlier ask (also / now / same as before) |
| `feat_specificity_score` | `min(10, (3·paths + 2·identifiers + 2·inline_code + constraints) / max(words,20) · 10)` |
| `n_changes` / `n_files_touched` | Code changes attributed to this prompt |
| `n_findings_total` | All Semgrep findings on the post-edit contents of those changes |
| `n_findings_new` | Findings **introduced** by those changes (`is_new = 1`) |
| `n_new_error` / `n_new_warning` / `n_new_info` | New findings by Semgrep severity |
| `distinct_new_rules` | Distinct rule ids among new findings |
| `n_scans_pending` | >0 means outcomes for this prompt are not settled yet |

Keyword features are matched case-insensitively with fenced code blocks
stripped first, so pasted code doesn't pollute the counts. All feature
definitions live in `src/vibetrace/features.py`.

`dump.json` carries the full relational data (sessions, prompts, changes,
scans, findings) plus `meta` (schema/features/tool versions) and the exact
scan configurations used.

## Limitations (read before drawing conclusions)

- **Attribution is heuristic** on older Claude Code versions (most-recent-prompt
  fallback); prompts that cause *no* edits are honest zeros, but an edit made
  many turns after its true cause can be misattributed.
- **Single-file scanning**: before/after contents are scanned as lone files, so
  cross-file dataflow rules won't fire; both sides of the diff are scanned
  identically, so the *comparison* stays fair.
- **Semgrep ≠ ground truth**: findings are static-analysis signals with false
  positives/negatives; treat counts as a proxy, not a verdict.
- **Bash-mediated edits aren't captured** (only Edit/Write/MultiEdit/NotebookEdit
  tools are hooked); `sed`/heredoc edits by the agent bypass capture.
- Correlations on `/stats` are descriptive; with few prompts they are noise.

## Development

```bash
pip install -e '.[dev]'
pytest                     # unit + e2e (semgrep-dependent tests auto-skip if absent)
```

Tests run offline: a local Semgrep ruleset lives in `tests/fixtures/rules/`,
and `VIBETRACE_FAKE_SEMGREP=<fixture.json>` substitutes canned scanner output
when semgrep isn't installed.
