import { nanoid } from 'nanoid';
import type {
  SecurityFinding,
  RawFinding,
  AnalysisRun,
  AnalysisStatus,
} from '@vibe/shared';
import { getDb } from '../connection.js';

interface FindingRow {
  id: string;
  project_id: string;
  turn_id: string | null;
  analyzer: string;
  severity: string;
  cwe: string | null;
  title: string;
  description: string;
  file: string | null;
  line_start: number | null;
  line_end: number | null;
  confidence: number | null;
  metadata_json: string | null;
  created_at: number;
}

function toFinding(r: FindingRow): SecurityFinding {
  return {
    id: r.id,
    projectId: r.project_id,
    turnId: r.turn_id,
    analyzer: r.analyzer,
    severity: r.severity as SecurityFinding['severity'],
    cwe: r.cwe ?? undefined,
    title: r.title,
    description: r.description,
    file: r.file ?? undefined,
    lineStart: r.line_start ?? undefined,
    lineEnd: r.line_end ?? undefined,
    confidence: r.confidence ?? undefined,
    metadata: r.metadata_json ? JSON.parse(r.metadata_json) : undefined,
    createdAt: r.created_at,
  };
}

export function insertFindings(
  projectId: string,
  turnId: string | null,
  analyzer: string,
  findings: RawFinding[],
): void {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO security_findings (id, project_id, turn_id, analyzer, severity, cwe, title,
        description, file, line_start, line_end, confidence, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const now = Date.now();
  const tx = db.transaction((rows: RawFinding[]) => {
    for (const f of rows) {
      stmt.run(
        nanoid(),
        projectId,
        turnId,
        analyzer,
        f.severity,
        f.cwe ?? null,
        f.title,
        f.description,
        f.file ?? null,
        f.lineStart ?? null,
        f.lineEnd ?? null,
        f.confidence ?? null,
        f.metadata ? JSON.stringify(f.metadata) : null,
        now,
      );
    }
  });
  tx(findings);
}

export function listFindings(
  projectId: string,
  turnId?: string,
): SecurityFinding[] {
  const db = getDb();
  const rows = turnId
    ? (db
        .prepare(
          'SELECT * FROM security_findings WHERE project_id = ? AND turn_id = ? ORDER BY created_at DESC',
        )
        .all(projectId, turnId) as FindingRow[])
    : (db
        .prepare(
          'SELECT * FROM security_findings WHERE project_id = ? ORDER BY created_at DESC',
        )
        .all(projectId) as FindingRow[]);
  return rows.map(toFinding);
}

export function countFindings(projectId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS c FROM security_findings WHERE project_id = ?')
    .get(projectId) as { c: number };
  return row.c;
}

/** Remove prior findings for a turn so re-analysis replaces rather than duplicates. */
export function clearFindingsForTurn(projectId: string, turnId: string | null): void {
  const db = getDb();
  if (turnId) {
    db.prepare(
      'DELETE FROM security_findings WHERE project_id = ? AND turn_id = ?',
    ).run(projectId, turnId);
  } else {
    db.prepare(
      'DELETE FROM security_findings WHERE project_id = ? AND turn_id IS NULL',
    ).run(projectId);
  }
}

// --- analysis runs ---

interface RunRow {
  id: string;
  project_id: string;
  turn_id: string | null;
  analyzer: string;
  status: string;
  finding_count: number;
  error: string | null;
  started_at: number;
  finished_at: number | null;
}

function toRun(r: RunRow): AnalysisRun {
  return {
    id: r.id,
    projectId: r.project_id,
    turnId: r.turn_id,
    analyzer: r.analyzer,
    status: r.status as AnalysisStatus,
    findingCount: r.finding_count,
    error: r.error,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
  };
}

export function createAnalysisRun(
  projectId: string,
  turnId: string | null,
  analyzer: string,
): AnalysisRun {
  const db = getDb();
  const row: RunRow = {
    id: nanoid(),
    project_id: projectId,
    turn_id: turnId,
    analyzer,
    status: 'running',
    finding_count: 0,
    error: null,
    started_at: Date.now(),
    finished_at: null,
  };
  db.prepare(
    `INSERT INTO analysis_runs (id, project_id, turn_id, analyzer, status, finding_count, error, started_at, finished_at)
     VALUES (@id, @project_id, @turn_id, @analyzer, @status, @finding_count, @error, @started_at, @finished_at)`,
  ).run(row);
  return toRun(row);
}

export function finishAnalysisRun(
  id: string,
  findingCount: number,
): void {
  getDb()
    .prepare(
      `UPDATE analysis_runs SET status = 'complete', finding_count = ?, finished_at = ? WHERE id = ?`,
    )
    .run(findingCount, Date.now(), id);
}

export function failAnalysisRun(id: string, error: string): void {
  getDb()
    .prepare(
      `UPDATE analysis_runs SET status = 'error', error = ?, finished_at = ? WHERE id = ?`,
    )
    .run(error, Date.now(), id);
}

export function getAnalysisRun(id: string): AnalysisRun | null {
  const r = getDb().prepare('SELECT * FROM analysis_runs WHERE id = ?').get(id) as
    | RunRow
    | undefined;
  return r ? toRun(r) : null;
}
