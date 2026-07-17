import express, { Router, type Express } from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT } from './config.js';
import { projectsRouter } from './routes/projects.js';
import { filesRouter } from './routes/files.js';
import { turnsRouter } from './routes/turns.js';
import { runRouter } from './routes/run.js';
import { deployRouter, deploymentsRouter } from './routes/deploy.js';
import { githubRouter } from './routes/github.js';
import {
  securityRouter,
  analyzersRouter,
  analysisRunsRouter,
} from './routes/security.js';
import { runProxyMiddleware, siteProxyMiddleware } from './runner/proxy.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());

  // Generated files can be large; the proxy routes below stream and are
  // registered before the body parser so they aren't buffered.
  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  // Reverse proxy for generated apps (must come before the SPA fallback and
  // before JSON parsing so request bodies stream straight through).
  app.use('/run/:projectId', runProxyMiddleware);
  app.use('/sites/:slug', siteProxyMiddleware);

  app.use(express.json({ limit: '12mb' }));

  const api = Router();
  api.use('/projects/:id/files', filesRouter);
  api.use('/projects/:id', turnsRouter);
  api.use('/projects/:id', runRouter);
  api.use('/projects/:id', deployRouter);
  api.use('/projects/:id', githubRouter);
  api.use('/projects/:id', securityRouter);
  api.use('/analyzers', analyzersRouter);
  api.use('/analysis-runs', analysisRunsRouter);
  api.use('/deployments', deploymentsRouter);
  api.use('/projects', projectsRouter);
  app.use('/api', api);

  // Serve the built web UI in production; in dev Vite serves it and proxies here.
  const webDist = resolve(REPO_ROOT, 'web', 'dist');
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^(?!\/api|\/run|\/sites).*/, (_req, res) => {
      res.sendFile(resolve(webDist, 'index.html'));
    });
  }

  return app;
}
