import type { ProjectFile } from '@vibe/shared';
import { getDb } from '../connection.js';

interface FileRow {
  path: string;
  content: string;
  updated_turn: string | null;
  updated_at: number;
}

export function getProjectFiles(projectId: string): ProjectFile[] {
  const rows = getDb()
    .prepare(
      'SELECT path, content, updated_turn, updated_at FROM project_files WHERE project_id = ? ORDER BY path',
    )
    .all(projectId) as FileRow[];
  return rows.map((r) => ({
    path: r.path,
    content: r.content,
    updatedTurn: r.updated_turn,
    updatedAt: r.updated_at,
  }));
}

export function getProjectFile(
  projectId: string,
  path: string,
): ProjectFile | null {
  const r = getDb()
    .prepare(
      'SELECT path, content, updated_turn, updated_at FROM project_files WHERE project_id = ? AND path = ?',
    )
    .get(projectId, path) as FileRow | undefined;
  return r
    ? {
        path: r.path,
        content: r.content,
        updatedTurn: r.updated_turn,
        updatedAt: r.updated_at,
      }
    : null;
}

export function upsertFile(
  projectId: string,
  path: string,
  content: string,
  turnId: string,
): void {
  getDb()
    .prepare(
      `INSERT INTO project_files (project_id, path, content, updated_turn, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(project_id, path)
       DO UPDATE SET content = excluded.content,
                     updated_turn = excluded.updated_turn,
                     updated_at = excluded.updated_at`,
    )
    .run(projectId, path, content, turnId, Date.now());
}

export function deleteFile(projectId: string, path: string): void {
  getDb()
    .prepare('DELETE FROM project_files WHERE project_id = ? AND path = ?')
    .run(projectId, path);
}

/** Set the file for an in-editor manual edit (no turn attached). */
export function setFileManual(
  projectId: string,
  path: string,
  content: string,
): void {
  getDb()
    .prepare(
      `INSERT INTO project_files (project_id, path, content, updated_turn, updated_at)
       VALUES (?, ?, ?, NULL, ?)
       ON CONFLICT(project_id, path)
       DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
    )
    .run(projectId, path, content, Date.now());
}
