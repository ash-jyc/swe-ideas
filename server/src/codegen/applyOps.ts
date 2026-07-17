import type { FileOp } from '@vibe/shared';
import { config } from '../config.js';
import {
  getProjectFiles,
  upsertFile,
  deleteFile,
} from '../db/repositories/files.js';
import {
  insertFileOp,
  saveSnapshot,
} from '../db/repositories/turns.js';
import { unifiedDiff } from './diff.js';

export interface ApplyResult {
  written: string[];
  deleted: string[];
  warnings: string[];
}

/**
 * Apply parsed file ops for a turn: update the current file set, record each
 * op with its unified diff, and snapshot the full resulting file set.
 */
export function applyOps(
  projectId: string,
  turnId: string,
  ops: FileOp[],
): ApplyResult {
  const current = new Map<string, string>();
  for (const f of getProjectFiles(projectId)) current.set(f.path, f.content);

  const written: string[] = [];
  const deleted: string[] = [];
  const warnings: string[] = [];

  for (const op of ops) {
    if (op.op === 'write') {
      if (Buffer.byteLength(op.content, 'utf8') > config.maxFileBytes) {
        warnings.push(`Skipped oversized file: ${op.path}`);
        continue;
      }
      const before = current.get(op.path) ?? '';
      const diff = unifiedDiff(op.path, before, op.content);
      upsertFile(projectId, op.path, op.content, turnId);
      insertFileOp(turnId, op.path, 'write', op.content, diff);
      current.set(op.path, op.content);
      written.push(op.path);
    } else {
      if (!current.has(op.path)) {
        warnings.push(`Delete of non-existent file: ${op.path}`);
        continue;
      }
      const before = current.get(op.path) ?? '';
      const diff = unifiedDiff(op.path, before, '');
      deleteFile(projectId, op.path);
      insertFileOp(turnId, op.path, 'delete', null, diff);
      current.delete(op.path);
      deleted.push(op.path);
    }
  }

  const snapshot = [...current.entries()].map(([path, content]) => ({
    path,
    content,
  }));
  saveSnapshot(turnId, snapshot);

  return { written, deleted, warnings };
}
