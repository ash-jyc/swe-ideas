import type { AnalyzerRequest, AnalysisRun } from '@vibe/shared';
import { getAnalyzer } from './analyzer.js';
import { getProjectFiles } from '../db/repositories/files.js';
import {
  getTurn,
  getFileOps,
  getSnapshot,
} from '../db/repositories/turns.js';
import {
  createAnalysisRun,
  finishAnalysisRun,
  failAnalysisRun,
  insertFindings,
  clearFindingsForTurn,
} from '../db/repositories/findings.js';

/**
 * Orchestrate one analysis: build the analyzer request from the turn (or the
 * current file set), run the analyzer, and persist findings linked to the turn
 * whose prompt produced the code. Runs asynchronously; the caller polls the
 * returned run's status via GET /analysis-runs/:id.
 */
export function startAnalysis(
  projectId: string,
  turnId: string | undefined,
  analyzerId: string | undefined,
): AnalysisRun {
  const analyzer = getAnalyzer(analyzerId);
  const run = createAnalysisRun(projectId, turnId ?? null, analyzer.id);

  // fire-and-forget
  void (async () => {
    try {
      const req = buildRequest(projectId, turnId);
      const result = await analyzer.analyze(req);
      clearFindingsForTurn(projectId, turnId ?? null);
      insertFindings(projectId, turnId ?? null, analyzer.id, result.findings);
      finishAnalysisRun(run.id, result.findings.length);
    } catch (e) {
      failAnalysisRun(run.id, e instanceof Error ? e.message : String(e));
    }
  })();

  return run;
}

function buildRequest(
  projectId: string,
  turnId: string | undefined,
): AnalyzerRequest {
  if (turnId) {
    const turn = getTurn(turnId);
    const snapshot = getSnapshot(turnId);
    const files = snapshot.length
      ? snapshot
      : getProjectFiles(projectId).map((f) => ({ path: f.path, content: f.content }));
    const diff = getFileOps(turnId)
      .filter((o) => o.unifiedDiff)
      .map((o) => ({ path: o.path, unifiedDiff: o.unifiedDiff! }));
    return {
      projectId,
      turnId,
      prompt: turn?.prompt,
      files,
      diff,
    };
  }
  return {
    projectId,
    files: getProjectFiles(projectId).map((f) => ({
      path: f.path,
      content: f.content,
    })),
  };
}
