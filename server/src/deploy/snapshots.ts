import { rmSync, existsSync } from 'node:fs';
import type { Deployment } from '@vibe/shared';
import { getProject } from '../db/repositories/projects.js';
import { getProjectFiles } from '../db/repositories/files.js';
import { listTurns } from '../db/repositories/turns.js';
import {
  getDeploymentByProject,
  getDeploymentBySlug,
  upsertDeployment,
  setDeploymentStatus,
  listLiveDeployments,
} from '../db/repositories/deployments.js';
import { appManager, siteId } from '../runner/manager.js';
import { materialize, siteDir } from '../runner/materialize.js';

function slugify(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'site'
  );
}

/** Snapshot the project's current files and (re)start a persistent instance. */
export async function deployProject(
  projectId: string,
  requestedSlug?: string,
): Promise<Deployment> {
  const project = getProject(projectId);
  if (!project) throw new Error('Project not found');

  const existing = getDeploymentByProject(projectId);
  const slug = requestedSlug ? slugify(requestedSlug) : existing?.slug ?? project.slug;

  // Guard against colliding with a different project's slug.
  const clash = getDeploymentBySlug(slug);
  if (clash && clash.projectId !== projectId) {
    throw new Error(`The name "${slug}" is already taken by another deployment`);
  }

  const files = getProjectFiles(projectId).map((f) => ({
    path: f.path,
    content: f.content,
  }));
  if (!files.some((f) => f.path === 'server.js')) {
    throw new Error('Nothing to deploy yet — generate an app with a server.js first');
  }

  // If the slug changed, tear down the old site.
  if (existing && existing.slug !== slug) {
    await appManager.stop(siteId(existing.slug));
    const oldDir = siteDir(existing.slug);
    if (existsSync(oldDir)) rmSync(oldDir, { recursive: true, force: true });
  }

  const turns = listTurns(projectId).filter((t) => t.status === 'complete');
  const turnId = turns.length ? turns[turns.length - 1]!.id : null;

  const deployment = upsertDeployment(projectId, slug, turnId, 'building');

  const dir = siteDir(slug);
  materialize(dir, files);
  const inst = await appManager.launch(siteId(slug), dir, true);

  const status = inst.state === 'running' ? 'live' : 'error';
  setDeploymentStatus(deployment.id, status);
  return { ...deployment, status };
}

export async function stopDeployment(deployment: Deployment): Promise<void> {
  await appManager.stop(siteId(deployment.slug));
  setDeploymentStatus(deployment.id, 'stopped');
}

/** Re-launch deployments that were live before a platform restart. */
export async function resumeDeployments(): Promise<void> {
  for (const d of listLiveDeployments()) {
    const dir = siteDir(d.slug);
    if (!existsSync(dir)) {
      setDeploymentStatus(d.id, 'error');
      continue;
    }
    try {
      const inst = await appManager.launch(siteId(d.slug), dir, true);
      setDeploymentStatus(d.id, inst.state === 'running' ? 'live' : 'error');
    } catch {
      setDeploymentStatus(d.id, 'error');
    }
  }
}
