import { Router } from 'express';
import type { CreateProjectRequest, ProjectDetail } from '@vibe/shared';
import {
  createProject,
  listProjects,
  getProject,
  deleteProject,
} from '../db/repositories/projects.js';
import { getProjectFiles } from '../db/repositories/files.js';
import { latestTurnSeq } from '../db/repositories/turns.js';
import { countFindings } from '../db/repositories/findings.js';
import { buildFileTree } from '../util/fileTree.js';
import { previewStatus, stopPreview } from '../runner/service.js';

export const projectsRouter = Router();

function detail(projectId: string): ProjectDetail | null {
  const project = getProject(projectId);
  if (!project) return null;
  const files = getProjectFiles(projectId);
  return {
    ...project,
    fileTree: buildFileTree(
      files.map((f) => ({ path: f.path, size: Buffer.byteLength(f.content, 'utf8') })),
    ),
    latestTurnSeq: latestTurnSeq(projectId),
    runStatus: previewStatus(projectId),
    findingCount: countFindings(projectId),
  };
}

projectsRouter.get('/', (_req, res) => {
  const projects = listProjects().map((p) => ({
    ...p,
    findingCount: countFindings(p.id),
    runStatus: previewStatus(p.id).state,
  }));
  res.json(projects);
});

projectsRouter.post('/', (req, res) => {
  const body = req.body as CreateProjectRequest;
  if (!body?.name || typeof body.name !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const project = createProject(body.name.trim(), body.description?.trim());
  res.status(201).json(project);
});

projectsRouter.get('/:id', (req, res) => {
  const d = detail(req.params.id);
  if (!d) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json(d);
});

projectsRouter.delete('/:id', async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  await stopPreview(project.id);
  deleteProject(project.id);
  res.json({ ok: true });
});
