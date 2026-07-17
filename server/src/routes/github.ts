import { Router } from 'express';
import type { GithubExportRequest, GithubExportResponse } from '@vibe/shared';
import { getProject } from '../db/repositories/projects.js';
import { getProjectFiles } from '../db/repositories/files.js';
import { exportToGithub } from '../github/exporter.js';
import { getParam } from '../util/params.js';

export const githubRouter = Router({ mergeParams: true });

// POST /api/projects/:id/github/export
githubRouter.post('/github/export', async (req, res) => {
  const projectId = getParam(req, 'id');
  if (!getProject(projectId)) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const body = req.body as GithubExportRequest;
  if (!body?.token || !body?.repoName) {
    res.status(400).json({ error: 'token and repoName are required' });
    return;
  }
  const files = getProjectFiles(projectId).map((f) => ({
    path: f.path,
    content: f.content,
  }));
  try {
    const result: GithubExportResponse = await exportToGithub(
      body.token,
      body.repoName,
      files,
      { private: body.private, description: body.description },
    );
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});
