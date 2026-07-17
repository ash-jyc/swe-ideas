import {
  mkdirSync,
  writeFileSync,
  rmSync,
  readdirSync,
  symlinkSync,
  existsSync,
  lstatSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { config, dataPath } from '../config.js';

// Files/dirs that must survive a re-materialize (runtime state, not source).
const PRESERVE = new Set([
  'node_modules',
  'data.sqlite',
  'data.sqlite-wal',
  'data.sqlite-shm',
  'data.sqlite-journal',
]);

export function previewDir(projectId: string): string {
  return dataPath('workspaces', projectId);
}

export function siteDir(slug: string): string {
  return dataPath('deployments', slug);
}

/** Point the app's node_modules at the hoisted root install (no per-app npm). */
function ensureNodeModules(dir: string): void {
  const link = join(dir, 'node_modules');
  if (existsSync(link)) {
    try {
      if (lstatSync(link).isSymbolicLink()) return;
      rmSync(link, { recursive: true, force: true });
    } catch {
      return;
    }
  }
  try {
    symlinkSync(config.nodeModulesDir, link, 'dir');
  } catch {
    // best-effort; NODE_PATH in the child env is the fallback
  }
}

/**
 * Ensure a package.json exists so `node server.js` uses the right module system.
 * Respect a model-provided one; otherwise infer ESM vs CJS from server.js.
 */
function ensurePackageJson(
  dir: string,
  files: { path: string; content: string }[],
): void {
  if (files.some((f) => f.path === 'package.json')) return;
  const server = files.find((f) => f.path === 'server.js');
  const isEsm =
    !server ||
    /\bimport\s.+\sfrom\s/.test(server.content) ||
    /\bexport\s/.test(server.content) ||
    /\bimport\(/.test(server.content);
  const pkg = {
    name: 'generated-app',
    private: true,
    type: isEsm ? 'module' : 'commonjs',
  };
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
}

function cleanSource(dir: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (PRESERVE.has(entry)) continue;
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

function writeFiles(dir: string, files: { path: string; content: string }[]): void {
  for (const f of files) {
    const target = resolve(dir, f.path);
    // defense in depth against traversal (parser already rejects "..")
    if (!target.startsWith(resolve(dir))) continue;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, f.content);
  }
}

/** Write the given file set to a working directory and wire up node_modules. */
export function materialize(
  dir: string,
  files: { path: string; content: string }[],
): void {
  mkdirSync(dir, { recursive: true });
  cleanSource(dir);
  writeFiles(dir, files);
  ensurePackageJson(dir, files);
  ensureNodeModules(dir);
}
