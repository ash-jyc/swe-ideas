# Plugging in a security analyzer

The platform ships the storage, endpoints, and UI for security findings. It
comes with a **placeholder** heuristic scanner (`stub-heuristic`). Replace it
with your own analyzer — for example, an LLM agent — by implementing one
interface and registering it. No schema, endpoint, or UI changes are needed.

## The interface

`server/src/security/analyzer.ts`:

```ts
export interface SecurityAnalyzer {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  analyze(req: AnalyzerRequest): Promise<AnalyzerResult>;
}
```

`AnalyzerRequest` (from `@vibe/shared`) gives you everything needed to attribute
a finding to the prompt that produced the code:

```ts
interface AnalyzerRequest {
  projectId: string;
  turnId?: string;                                  // the analyzed turn
  prompt?: string;                                  // the prompt that produced the code
  files: { path: string; content: string }[];       // full file set as of that turn
  diff?: { path: string; unifiedDiff: string }[];    // what the turn changed
}
```

Return `RawFinding[]` with `severity`, optional `cwe`, `title`, `description`,
optional `file` / `lineStart` / `lineEnd` / `confidence` / `metadata`.

## Registering your analyzer

In `server/src/index.ts` (after `migrate()`):

```ts
import { registerAnalyzer } from './security/analyzer.js';
import { myAnalyzer } from './security/myAnalyzer.js';

registerAnalyzer(myAnalyzer, true); // `true` = make it the default
```

That's it. It appears in the analyzer dropdown, `POST /api/projects/:id/analyze`
routes to it, and findings it returns are persisted linked to `projectId` +
`turnId` and rendered in the Security tab, grouped by the originating turn.

## Using BYOK credentials

Findings are stored per turn, and each turn records its provider/model. If your
analyzer is itself an LLM agent, pass credentials through the request (e.g. a
future field on `AnalyzerRequest`, or read them from a secure config) — keep the
same posture as the rest of the platform: never persist keys server-side.

## Orchestration

`server/src/security/runAnalysis.ts` builds the request from the turn's snapshot
+ prompt + diff, runs the analyzer asynchronously, records an `analysis_runs`
row (poll it at `GET /api/analysis-runs/:id`), and replaces the turn's prior
findings on success.
