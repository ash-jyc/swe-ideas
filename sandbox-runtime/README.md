# @vibe/sandbox-runtime

This workspace exists **only to declare the closed set of npm packages that
generated apps are allowed to import.** It has no source of its own.

## How it works

- These dependencies are installed once at the monorepo root (`npm install`),
  where npm workspaces hoist them into the root `node_modules`.
- When the platform materializes a generated app to disk, it creates a
  `node_modules` symlink from the app's workspace directory to the root
  `node_modules`. Node's resolver then finds these packages normally — **no
  per-app `npm install` runs.**
- The exact resolved versions are read at server boot and injected into the
  codegen system prompt so the model knows precisely what is available.

## Available packages

| Package | Purpose |
| --- | --- |
| `express` | HTTP server / routing |
| `cors` | CORS middleware |
| `better-sqlite3` | Synchronous embedded SQL database |
| `nanoid` | ID generation |
| `zod` | Schema validation |
| `bcryptjs` | Password hashing |
| `jsonwebtoken` | JWT signing/verification |
| `cookie-parser` | Cookie parsing middleware |

Plus all Node.js ≥20 built-in modules.

A generated app that imports anything outside this set will fail at runtime.
That failure surfaces in the app's run logs and is itself a research signal —
the platform never auto-installs missing packages.
