import { Router } from 'express';
import type { DeployRequest } from '@vibe/shared';
import { getProject } from '../db/repositories/projects.js';
import {
  listDeploymentsForProject,
  getDeployment,
} from '../db/repositories/deployments.js';
import { deployProject, stopDeployment } from '../deploy/snapshots.js';
import { getParam } from '../util/params.js';

export const deployRouter = Router({ mergeParams: true });

// POST /api/projects/:id/deploy
deployRouter.post('/deploy', async (req, res) => {
  const projectId = getParam(req, 'id');
  if (!getProject(projectId)) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const body = (req.body ?? {}) as DeployRequest;
  try {
    const deployment = await deployProject(projectId, body.slug);
    res.json({ ...deployment, url: `/sites/${deployment.slug}/` });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

deployRouter.get('/deployments', (req, res) => {
  const deployments = listDeploymentsForProject(getParam(req, 'id')).map((d) => ({
    ...d,
    url: `/sites/${d.slug}/`,
  }));
  res.json(deployments);
});

// POST /api/deployments/:deploymentId/stop  (mounted separately)
export const deploymentsRouter = Router();
deploymentsRouter.post('/:deploymentId/stop', async (req, res) => {
  const deployment = getDeployment(req.params.deploymentId);
  if (!deployment) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  await stopDeployment(deployment);
  res.json({ ok: true });
});
