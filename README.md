# swe-idea

Built from a brainstorm list of 81 project ideas. The chosen idea — **#64: "secure software MCP for vibe coders"**, evolved into a multi-agent framework — was picked as the most impactful: it's the strongest recurring theme in the list (#50 "AI try to break code and fix it", #56 Claude MCP, #63 "security audit of vibe coding", #75 agent SDKs, #78 "secure vibe coding platform"), and it targets a documented, growing gap: AI-generated apps shipping with security holes (Moltbook, Tea, and Lovable all breached through exactly these flaw classes in 2025–26).

## → [`vibesec/`](./vibesec)

**VibeSec** is a multi-agent security audit framework for vibe-coded projects:

- a **deterministic rule engine** (~40 evidence-based checks: leaked secrets, Supabase RLS off, open Firebase rules, SQL/command/log injection, XSS, weak crypto, unsafe deserialization, risky dependencies) that runs offline, plus
- a **Claude Agent SDK pipeline** — Auditor → Verifier → Fixer — that hunts what regex can't see (broken object-level authorization, frontend-only access checks), kills false positives by re-reading the code, and drafts patches,
- ending each report with a **hardened prompt block** to paste into your AI assistant so the next feature is built securely from the start.

```bash
cd vibesec
npm install && npm run build && npm test   # 118 tests, fully offline
node dist/cli.js audit test/fixtures/vulnerable-app --offline
```

See [`vibesec/README.md`](./vibesec/README.md) for the research basis, architecture, and full usage.
