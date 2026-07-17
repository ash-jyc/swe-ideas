import { nanoid } from 'nanoid';
import type { Deployment, DeploymentStatus } from '@vibe/shared';
import { getDb } from '../connection.js';

interface DeploymentRow {
  id: string;
  project_id: string;
  slug: string;
  turn_id: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

function toDeployment(r: DeploymentRow): Deployment {
  return {
    id: r.id,
    projectId: r.project_id,
    slug: r.slug,
    turnId: r.turn_id,
    status: r.status as DeploymentStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Get the existing deployment for a project (single deployment per project). */
export function getDeploymentByProject(projectId: string): Deployment | null {
  const r = getDb()
    .prepare('SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(projectId) as DeploymentRow | undefined;
  return r ? toDeployment(r) : null;
}

export function getDeployment(id: string): Deployment | null {
  const r = getDb().prepare('SELECT * FROM deployments WHERE id = ?').get(id) as
    | DeploymentRow
    | undefined;
  return r ? toDeployment(r) : null;
}

export function getDeploymentBySlug(slug: string): Deployment | null {
  const r = getDb()
    .prepare('SELECT * FROM deployments WHERE slug = ?')
    .get(slug) as DeploymentRow | undefined;
  return r ? toDeployment(r) : null;
}

export function upsertDeployment(
  projectId: string,
  slug: string,
  turnId: string | null,
  status: DeploymentStatus,
): Deployment {
  const db = getDb();
  const existing = getDeploymentByProject(projectId);
  const now = Date.now();
  if (existing) {
    db.prepare(
      'UPDATE deployments SET slug = ?, turn_id = ?, status = ?, updated_at = ? WHERE id = ?',
    ).run(slug, turnId, status, now, existing.id);
    return { ...existing, slug, turnId, status, updatedAt: now };
  }
  const row: DeploymentRow = {
    id: nanoid(),
    project_id: projectId,
    slug,
    turn_id: turnId,
    status,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO deployments (id, project_id, slug, turn_id, status, created_at, updated_at)
     VALUES (@id, @project_id, @slug, @turn_id, @status, @created_at, @updated_at)`,
  ).run(row);
  return toDeployment(row);
}

export function setDeploymentStatus(id: string, status: DeploymentStatus): void {
  getDb()
    .prepare('UPDATE deployments SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, Date.now(), id);
}

export function listLiveDeployments(): Deployment[] {
  const rows = getDb()
    .prepare("SELECT * FROM deployments WHERE status = 'live'")
    .all() as DeploymentRow[];
  return rows.map(toDeployment);
}

export function listDeploymentsForProject(projectId: string): Deployment[] {
  const rows = getDb()
    .prepare('SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId) as DeploymentRow[];
  return rows.map(toDeployment);
}
