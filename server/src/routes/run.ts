import { Router } from 'express';
import { getProject } from '../db/repositories/projects.js';
import {
  ensurePreviewRunning,
  restartPreview,
  stopPreview,
  previewStatus,
  hasRunnableEntry,
} from '../runner/service.js';
import { appManager, previewId } from '../runner/manager.js';
import { initSse, sseSend } from '../util/sse.js';
import { getParam } from '../util/params.js';

export const runRouter = Router({ mergeParams: true });

runRouter.post('/run', async (req, res) => {
  const projectId = getParam(req, 'id');
  if (!getProject(projectId)) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  if (!hasRunnableEntry(projectId)) {
    res.status(400).json({ error: 'No server.js to run yet' });
    return;
  }
  const inst = await restartPreview(projectId);
  res.json(previewStatusFrom(projectId, inst.state));
});

runRouter.post('/stop', async (req, res) => {
  await stopPreview(getParam(req, 'id'));
  res.json(previewStatus(getParam(req, 'id')));
});

runRouter.get('/run/status', (req, res) => {
  res.json(previewStatus(getParam(req, 'id')));
});

// SSE stream of run logs (buffered history first, then live lines).
runRouter.get('/run/logs', (req, res) => {
  const projectId = getParam(req, 'id');
  // Warm the instance so logs exist even before an explicit run.
  void ensurePreviewRunning(projectId).catch(() => {});
  const logs = appManager.logs(previewId(projectId));
  initSse(res);
  for (const line of logs.snapshot()) sseSend(res, line);
  const unsub = logs.subscribe((line) => sseSend(res, line));
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 20000);
  res.on('close', () => {
    clearInterval(heartbeat);
    unsub();
  });
});

function previewStatusFrom(projectId: string, state: string) {
  return { ...previewStatus(projectId), state };
}
