import { nanoid } from 'nanoid';
import type { Project } from '@vibe/shared';
import { getDb } from '../connection.js';

interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
}

function toProject(r: ProjectRow): Project {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'app';
}

/** Produce a slug unique across projects and deployments. */
function uniqueSlug(name: string): string {
  const db = getDb();
  const base = slugify(name);
  let candidate = base;
  let n = 1;
  const exists = db.prepare(
    'SELECT 1 FROM projects WHERE slug = ? UNION SELECT 1 FROM deployments WHERE slug = ?',
  );
  while (exists.get(candidate, candidate)) {
    candidate = `${base}-${++n}`;
  }
  return candidate;
}

export function createProject(name: string, description?: string): Project {
  const db = getDb();
  const now = Date.now();
  const row: ProjectRow = {
    id: nanoid(),
    slug: uniqueSlug(name),
    name,
    description: description ?? null,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO projects (id, slug, name, description, created_at, updated_at)
     VALUES (@id, @slug, @name, @description, @created_at, @updated_at)`,
  ).run(row);
  return toProject(row);
}

export function listProjects(): Project[] {
  const rows = getDb()
    .prepare('SELECT * FROM projects ORDER BY updated_at DESC')
    .all() as ProjectRow[];
  return rows.map(toProject);
}

export function getProject(id: string): Project | null {
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as
    | ProjectRow
    | undefined;
  return row ? toProject(row) : null;
}

export function getProjectBySlug(slug: string): Project | null {
  const row = getDb()
    .prepare('SELECT * FROM projects WHERE slug = ?')
    .get(slug) as ProjectRow | undefined;
  return row ? toProject(row) : null;
}

export function touchProject(id: string): void {
  getDb()
    .prepare('UPDATE projects SET updated_at = ? WHERE id = ?')
    .run(Date.now(), id);
}

export function deleteProject(id: string): void {
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
}
