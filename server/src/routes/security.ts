import { Router } from 'express';
import type { AnalyzeRequest } from '@vibe/shared';
import { getProject } from '../db/repositories/projects.js';
import { listFindings, getAnalysisRun } from '../db/repositories/findings.js';
import { startAnalysis } from '../security/runAnalysis.js';
import { listAnalyzers } from '../security/analyzer.js';
import { getParam } from '../util/params.js';

export const securityRouter = Router({ mergeParams: true });

// POST /api/projects/:id/analyze  { turnId?, analyzer? }
securityRouter.post('/analyze', (req, res) => {
  const projectId = getParam(req, 'id');
  if (!getProject(projectId)) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const body = (req.body ?? {}) as AnalyzeRequest;
  try {
    const run = startAnalysis(projectId, body.turnId, body.analyzer);
    res.status(202).json(run);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// GET /api/projects/:id/findings?turnId=
securityRouter.get('/findings', (req, res) => {
  const projectId = getParam(req, 'id');
  const turnId = req.query.turnId ? String(req.query.turnId) : undefined;
  res.json(listFindings(projectId, turnId));
});

// Analyzer registry introspection (mounted at /api/analyzers).
export const analyzersRouter = Router();
analyzersRouter.get('/', (_req, res) => {
  res.json(listAnalyzers());
});

// Analysis run status (mounted at /api/analysis-runs).
export const analysisRunsRouter = Router();
analysisRunsRouter.get('/:runId', (req, res) => {
  const run = getAnalysisRun(req.params.runId);
  if (!run) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json(run);
});
