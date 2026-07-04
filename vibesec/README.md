# VibeSec

**Multi-agent security audit framework for vibe-coded projects.**

AI coding assistants ship features fast — and ship the same security holes over and over. Independent research backs this up: 45% of AI-generated code contains OWASP-class flaws (Veracode 2025, 100+ models), models fail XSS tasks 86% of the time and log-injection tasks 88% of the time, and a scan of 5,600 live vibe-coded apps found 2,000+ high-impact vulnerabilities and 400+ exposed secrets (Escape.tech). The breaches that made headlines — Moltbook (1.5M leaked API keys), Tea (72K ID photos), Lovable (cross-tenant project data) — all reduce to a handful of root causes: secrets in client bundles, backend-as-a-service misconfiguration, and authorization that only exists in the UI.

VibeSec audits a project for exactly those failure modes, using a two-layer design:

1. **A deterministic rule engine** (~40 checks, no LLM, runs offline) for everything pattern-detectable: committed secrets and `.env` files, Supabase `service_role` keys in client code, disabled Row Level Security, wide-open Firebase rules, SQL/command/log injection, XSS sinks, weak crypto and randomness, path traversal, unsafe deserialization, webhook handlers with no signature check, and risky/unpinned dependencies. Every rule carries a severity, CWE, concrete fix, and — where it applies — the real-world incident it caused.
2. **A multi-agent pipeline** on the [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview) for what regex can never see:
   - **Auditor** reads your routes and handlers hunting **broken access control (BOLA/IDOR)** — endpoints that fetch/delete objects by id without checking ownership, frontend-only role checks, mass assignment — plus broken auth flows, missing rate limiting, and PII over-exposure.
   - **Verifier** re-reads the code behind every candidate finding (from the rules *and* the Auditor) and confirms or rejects it, so the report isn't a false-positive dump.
   - **Fixer** (opt-in) drafts minimal unified-diff patches for confirmed findings. Patches are written to `vibesec-fixes/` for review — never auto-applied.

The report ends with a **"Harden your next prompt"** block: security requirements, derived from what was actually found, that you can paste into your AI assistant so the next feature doesn't repeat the mistakes.

## Usage

```bash
npm install
npm run build

# Deterministic scan only — free, offline, deterministic
node dist/cli.js audit /path/to/your/project --offline

# Full multi-agent audit (needs ANTHROPIC_API_KEY)
export ANTHROPIC_API_KEY=sk-ant-...
node dist/cli.js audit /path/to/your/project

# Also draft patches for confirmed findings
node dist/cli.js audit /path/to/your/project --fix

# Machine-readable output / write report to a file
node dist/cli.js audit /path/to/your/project --json
node dist/cli.js audit /path/to/your/project --out report.md
```

Exit codes make it CI-friendly: `0` clean, `1` critical/high findings, `2` usage error. Without an API key VibeSec degrades gracefully to scan-only mode.

Try it on the deliberately vulnerable fixture app (seeded with the Moltbook/Tea/Lovable failure patterns):

```bash
npm run audit:fixture
```

## Library API

```ts
import { runAudit, renderReport, scanProject, ScriptedDriver } from 'vibesec';

const report = await runAudit('/path/to/project', { fix: false });
console.log(renderReport(report));
```

The agent layer talks to models through a `ModelDriver` interface. Production uses `ClaudeAgentDriver` (Claude Agent SDK with read-only `Read`/`Glob`/`Grep` tools); tests use `ScriptedDriver`, which replays canned responses — the entire pipeline, including verifier veto logic and fixer patch flow, is exercised offline in the test suite.

## Design notes

- **Rules carry their own test vectors.** Every rule embeds vulnerable and clean examples, and the test suite enforces both directions — each rule must catch all of its vulnerable vectors and stay silent on all of its clean ones. That contract is what keeps false positives in check as rules are added.
- **The Verifier judges the rules too.** Deterministic findings aren't presumed correct; in full mode the Verifier re-reads the code and can reject a rule finding (e.g. a "hardcoded password" that's a test default). Rejected findings appear in an appendix, not the main report.
- **Agents are read-only.** The Auditor/Verifier/Fixer get `Read`/`Glob`/`Grep` only. The only writes VibeSec ever performs are the report and `.diff` files you asked for.
- **Provider-shaped tokens never appear in this repo.** Rule test vectors are assembled at runtime (string concatenation), so the repository itself passes secret scanners.

## Layout

```
src/
  core/      types, rules/ (secrets, baas, injection, web, crypto, filesystem),
             scanner (walk + per-line rules + project checks), advisories (offline dep table)
  agents/    definitions (Auditor/Verifier/Fixer prompts), drivers (ModelDriver:
             ClaudeAgentDriver | ScriptedDriver), pipeline (orchestration), json (robust extraction)
  report/    markdown renderer, hardened-prompt generator
  cli.ts     vibesec audit <dir> [--offline] [--fix] [--json] [--out <file>] [--model <name>]
test/
  rules/scanner/advisories/pipeline suites (118 tests, fully offline)
  fixtures/vulnerable-app/   intentionally vulnerable sample (fake credentials only)
```

## Scope, honestly

The rule engine is high-signal but not a full SAST — it has no dataflow analysis, and the dependency advisories are a small offline table, not a CVE database (`npm audit` / `pip-audit` remain worth running). The agent layer is non-deterministic and needs API credits; that's exactly why it sits on top of a deterministic core instead of replacing it. VibeSec is a defensive tool for auditing code you own or are authorized to review.
