import { Router } from 'express';
import { getProject } from '../db/repositories/projects.js';
import {
  getProjectFiles,
  getProjectFile,
  setFileManual,
} from '../db/repositories/files.js';
import { buildFileTree } from '../util/fileTree.js';
import { getParam } from '../util/params.js';
import { restartPreview } from '../runner/service.js';

export const filesRouter = Router({ mergeParams: true });

filesRouter.get('/', (req, res) => {
  const projectId = getParam(req, 'id');
  if (!getProject(projectId)) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const files = getProjectFiles(projectId);
  res.json(
    buildFileTree(
      files.map((f) => ({ path: f.path, size: Buffer.byteLength(f.content, 'utf8') })),
    ),
  );
});

// GET /api/projects/:id/files/content?path=...
filesRouter.get('/content', (req, res) => {
  const projectId = getParam(req, 'id');
  const path = String(req.query.path || '');
  const file = getProjectFile(projectId, path);
  if (!file) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json({ path: file.path, content: file.content });
});

// PUT /api/projects/:id/files/content  { path, content } — manual editor save.
filesRouter.put('/content', async (req, res) => {
  const projectId = getParam(req, 'id');
  const { path, content } = req.body ?? {};
  if (typeof path !== 'string' || typeof content !== 'string') {
    res.status(400).json({ error: 'path and content are required' });
    return;
  }
  setFileManual(projectId, path, content);
  // Reflect the edit in a running preview.
  void restartPreview(projectId).catch(() => {});
  res.json({ ok: true });
});
