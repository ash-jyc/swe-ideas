import { nanoid } from 'nanoid';
import type { Turn, TurnFileOp, TokenUsage } from '@vibe/shared';
import { getDb } from '../connection.js';

interface TurnRow {
  id: string;
  project_id: string;
  seq: number;
  prompt: string;
  raw_response: string;
  summary: string | null;
  provider: string;
  model: string;
  base_url: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  prompt_version: string;
  status: string;
  error: string | null;
  created_at: number;
  completed_at: number | null;
}

function toTurn(r: TurnRow): Turn {
  return {
    id: r.id,
    projectId: r.project_id,
    seq: r.seq,
    prompt: r.prompt,
    rawResponse: r.raw_response,
    summary: r.summary,
    provider: r.provider,
    model: r.model,
    baseUrl: r.base_url,
    usage: {
      promptTokens: r.prompt_tokens ?? undefined,
      completionTokens: r.completion_tokens ?? undefined,
      totalTokens: r.total_tokens ?? undefined,
    },
    promptVersion: r.prompt_version,
    status: r.status as Turn['status'],
    error: r.error,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  };
}

export function nextSeq(projectId: string): number {
  const row = getDb()
    .prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM turns WHERE project_id = ?')
    .get(projectId) as { m: number };
  return row.m + 1;
}

export interface CreateTurnInput {
  projectId: string;
  seq: number;
  prompt: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  promptVersion: string;
}

export function createTurn(input: CreateTurnInput): Turn {
  const db = getDb();
  const now = Date.now();
  const row: TurnRow = {
    id: nanoid(),
    project_id: input.projectId,
    seq: input.seq,
    prompt: input.prompt,
    raw_response: '',
    summary: null,
    provider: input.provider,
    model: input.model,
    base_url: input.baseUrl,
    prompt_tokens: null,
    completion_tokens: null,
    total_tokens: null,
    prompt_version: input.promptVersion,
    status: 'streaming',
    error: null,
    created_at: now,
    completed_at: null,
  };
  db.prepare(
    `INSERT INTO turns (id, project_id, seq, prompt, raw_response, summary, provider, model,
        base_url, prompt_tokens, completion_tokens, total_tokens, prompt_version, status, error,
        created_at, completed_at)
     VALUES (@id, @project_id, @seq, @prompt, @raw_response, @summary, @provider, @model,
        @base_url, @prompt_tokens, @completion_tokens, @total_tokens, @prompt_version, @status,
        @error, @created_at, @completed_at)`,
  ).run(row);
  return toTurn(row);
}

export interface CompleteTurnInput {
  turnId: string;
  rawResponse: string;
  summary: string;
  usage: TokenUsage;
}

export function completeTurn(input: CompleteTurnInput): void {
  getDb()
    .prepare(
      `UPDATE turns SET raw_response = ?, summary = ?, prompt_tokens = ?, completion_tokens = ?,
          total_tokens = ?, status = 'complete', completed_at = ? WHERE id = ?`,
    )
    .run(
      input.rawResponse,
      input.summary,
      input.usage.promptTokens ?? null,
      input.usage.completionTokens ?? null,
      input.usage.totalTokens ?? null,
      Date.now(),
      input.turnId,
    );
}

export function failTurn(turnId: string, rawResponse: string, error: string): void {
  getDb()
    .prepare(
      `UPDATE turns SET raw_response = ?, status = 'error', error = ?, completed_at = ? WHERE id = ?`,
    )
    .run(rawResponse, error, Date.now(), turnId);
}

export function listTurns(projectId: string): Turn[] {
  const rows = getDb()
    .prepare('SELECT * FROM turns WHERE project_id = ? ORDER BY seq ASC')
    .all(projectId) as TurnRow[];
  return rows.map(toTurn);
}

export function getTurn(turnId: string): Turn | null {
  const r = getDb().prepare('SELECT * FROM turns WHERE id = ?').get(turnId) as
    | TurnRow
    | undefined;
  return r ? toTurn(r) : null;
}

export function latestTurnSeq(projectId: string): number {
  const row = getDb()
    .prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM turns WHERE project_id = ?')
    .get(projectId) as { m: number };
  return row.m;
}

// --- file ops ---

interface OpRow {
  id: string;
  turn_id: string;
  path: string;
  op: string;
  content_after: string | null;
  unified_diff: string | null;
  created_at: number;
}

export function insertFileOp(
  turnId: string,
  path: string,
  op: 'write' | 'delete',
  contentAfter: string | null,
  unifiedDiff: string | null,
): void {
  getDb()
    .prepare(
      `INSERT INTO turn_file_ops (id, turn_id, path, op, content_after, unified_diff, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(nanoid(), turnId, path, op, contentAfter, unifiedDiff, Date.now());
}

export function getFileOps(turnId: string): TurnFileOp[] {
  const rows = getDb()
    .prepare('SELECT * FROM turn_file_ops WHERE turn_id = ? ORDER BY created_at ASC')
    .all(turnId) as OpRow[];
  return rows.map((r) => ({
    id: r.id,
    turnId: r.turn_id,
    path: r.path,
    op: r.op as 'write' | 'delete',
    contentAfter: r.content_after,
    unifiedDiff: r.unified_diff,
    createdAt: r.created_at,
  }));
}

// --- snapshots ---

export function saveSnapshot(
  turnId: string,
  files: { path: string; content: string }[],
): void {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO turn_snapshots (turn_id, path, content) VALUES (?, ?, ?)',
  );
  const tx = db.transaction((rows: { path: string; content: string }[]) => {
    for (const f of rows) stmt.run(turnId, f.path, f.content);
  });
  tx(files);
}

export function getSnapshot(turnId: string): { path: string; content: string }[] {
  return getDb()
    .prepare('SELECT path, content FROM turn_snapshots WHERE turn_id = ? ORDER BY path')
    .all(turnId) as { path: string; content: string }[];
}
