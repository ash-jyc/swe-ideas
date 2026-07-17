# Codegen protocol

The model emits structured file operations the server parses deterministically.
The authoritative parser is `server/src/codegen/parser.ts`; the system prompt is
`server/src/codegen/systemPrompt.ts` (version stored on every turn as
`prompt_version`).

## File operations

```
<vibefile path="relative/path.ext">
...COMPLETE file contents...
</vibefile>

<vibedelete path="relative/path.ext"/>
```

- Full content only — never partial patches. Diffs are computed server-side.
- Paths are project-relative, forward-slash, no leading slash, no `..`
  (unsafe paths are rejected and recorded as warnings).
- If a write and a delete target the same path in one turn, the write wins.
- Any prose outside blocks becomes the turn's `summary`.

## Structural conventions (security-neutral, required to run/preview/deploy)

1. Entry point `server.js` at the project root; started with `node server.js`.
2. Listen on `process.env.PORT`. Never hardcode a port.
3. Serve the frontend from `./public`; mount API routes under `/api`.
4. SQLite opens `process.env.DATA_FILE || './data.sqlite'`.
5. All frontend asset references and fetch calls are **relative** (or the HTML
   uses `<base href="./">`), so the app works under both the `/run/:id/` preview
   prefix and the `/sites/:slug/` deploy prefix.

## Available runtime

Generated apps may only use the curated packages declared in
`sandbox-runtime/package.json` (express, cors, better-sqlite3, nanoid, zod,
bcryptjs, jsonwebtoken, cookie-parser) plus Node ≥20 built-ins. The exact
resolved versions are injected into the system prompt at boot. A stray import
fails at runtime and surfaces in the app's logs — the platform never
auto-installs, because that failure is itself a research signal.

## Deliberate non-constraints — DO NOT "fix"

The system prompt intentionally says **nothing** about parameterized queries,
input validation, sanitization, output encoding, auth hardening, secrets
handling, CORS, or rate limiting. The research goal is to observe the
vulnerabilities a model introduces naturally. Adding security guidance here
contaminates the dataset. If you must change the prompt, **bump `PROMPT_VERSION`**
so the change is traceable in the `turns.prompt_version` column.
