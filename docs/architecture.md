# Architecture

## Monorepo layout

| Workspace | Role |
| --- | --- |
| `@vibe/shared` | TypeScript types shared by web + server (raw `.ts`, no build) |
| `@vibe/server` | Express API, LLM orchestration, app runner, reverse proxy |
| `@vibe/web` | React + Vite platform UI |
| `@vibe/sandbox-runtime` | Declares the curated npm set generated apps may use |

The server runs directly via `tsx` (no build step) — it is a long-running
stateful process. The web UI builds to `web/dist`, which the server serves in
production. In dev, Vite serves the UI and proxies `/api`, `/run`, `/sites` to
the server.

## Data model (SQLite, `better-sqlite3`, WAL)

- `projects` — id, slug, name, timestamps.
- `turns` — prompt, **full raw model response**, summary, provider/model,
  base_url, token counts, `prompt_version`, status. The core research row.
- `turn_file_ops` — per-turn `write`/`delete` with `content_after` and the
  computed `unified_diff`.
- `project_files` — current materialized file set (fast reads).
- `turn_snapshots` — full file set as of each turn (exact time-travel + re-analysis).
- `security_findings` — severity, CWE, file/line, linked to `project_id` + `turn_id`.
- `analysis_runs` — status of each analysis.
- `deployments` — slug, status, snapshot turn.

Keeping current files, per-turn diffs, **and** full snapshots is intentional and
cheap for text — it is the whole research capture.

## Request → code → run pipeline

1. `POST /api/projects/:id/generate` (SSE). Server builds context
   (system prompt + compact history + current files + new prompt), calls the
   selected LLM adapter, and streams tokens/file-op events to the browser while
   accumulating the raw response.
2. On completion the server does an **authoritative parse** of the raw response
   (`codegen/parser.ts`), applies the file ops, computes per-file unified diffs
   (`codegen/diff.ts`, `codegen/applyOps.ts`), snapshots the file set, and marks
   the turn complete.
3. The preview app is re-materialized to disk and (re)started
   (`runner/*`), then the iframe reloads.

## Running generated apps

- Materialized to `DATA_DIR/workspaces/<projectId>/`; a `node_modules` symlink
  points at the hoisted root install (curated deps only). No per-app npm.
- Spawned as `node server.js` on a loopback port with a **sanitized env**
  (`PORT`, `DATA_FILE`, minimal `PATH`, `NODE_PATH`; no platform/BYOK secrets),
  a heap cap, and idle/lifetime kills.
- Reverse-proxied: `/run/:projectId/*` (preview) and `/sites/:slug/*` (deploy)
  via `http-proxy`, stripping the prefix and injecting `<base>` into HTML as a
  safety net so relative asset/fetch URLs resolve.

## Deployment

Deploy copies the current file set into `DATA_DIR/deployments/<slug>/` (separate
from the mutable preview workspace) and starts a **persistent** instance served
at `/sites/<slug>/`. Live deployments are resumed on platform restart.

## LLM layer

One `LlmAdapter` interface, four adapters (`anthropic`, `openai`,
`openai-compatible`, `mock`), all using raw `fetch` and a shared SSE line parser
(`llm/stream.ts`). Adapters yield `text` and `usage` chunks; the route re-streams
them to the browser.
