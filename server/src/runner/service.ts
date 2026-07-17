import type { RunStatus } from '@vibe/shared';
import { getProjectFiles } from '../db/repositories/files.js';
import { getDeploymentBySlug } from '../db/repositories/deployments.js';
import { existsSync } from 'node:fs';
import {
  appManager,
  previewId,
  siteId,
  type Instance,
} from './manager.js';
import { materialize, previewDir, siteDir } from './materialize.js';

/** Write the project's current files to its preview workspace. */
export function materializePreview(projectId: string): string {
  const dir = previewDir(projectId);
  const files = getProjectFiles(projectId).map((f) => ({
    path: f.path,
    content: f.content,
  }));
  materialize(dir, files);
  return dir;
}

export function hasRunnableEntry(projectId: string): boolean {
  return getProjectFiles(projectId).some((f) => f.path === 'server.js');
}

/** Start the preview if needed (lazy), re-materializing current files. */
export function ensurePreviewRunning(projectId: string): Promise<Instance> {
  const dir = previewDir(projectId);
  return appManager.ensureRunning(previewId(projectId), dir, false, () => {
    materializePreview(projectId);
  });
}

/** Force a fresh start after a turn changed files. */
export function restartPreview(projectId: string): Promise<Instance> {
  const dir = materializePreview(projectId);
  return appManager.launch(previewId(projectId), dir, false);
}

export function stopPreview(projectId: string): Promise<void> {
  return appManager.stop(previewId(projectId));
}

export function previewStatus(projectId: string): RunStatus {
  return appManager.status(previewId(projectId), projectId);
}

/** Ensure a deployed site is running from its (already materialized) snapshot. */
export async function ensureSiteRunning(slug: string): Promise<Instance | null> {
  const deployment = getDeploymentBySlug(slug);
  if (!deployment) return null;
  const dir = siteDir(slug);
  if (!existsSync(dir)) return null;
  return appManager.ensureRunning(siteId(slug), dir, true, () => {
    // snapshot already on disk; nothing to re-materialize
  });
}
