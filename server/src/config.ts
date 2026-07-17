import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url)); // server/src

/** Monorepo root — where the hoisted node_modules lives. */
export const REPO_ROOT = resolve(here, '..', '..');

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

/** node_modules directory generated apps symlink to. Prefer the hoisted root. */
function resolveNodeModules(): string {
  const rootNm = resolve(REPO_ROOT, 'node_modules');
  if (existsSync(rootNm)) return rootNm;
  // Fallback: sandbox-runtime's own node_modules (non-hoisted installs).
  return resolve(REPO_ROOT, 'sandbox-runtime', 'node_modules');
}

export const config = {
  host: str('HOST', '0.0.0.0'),
  port: num('PORT', 3001),
  /** Durable data root; a persistent disk in production. */
  dataDir: resolve(str('DATA_DIR', resolve(REPO_ROOT, 'data'))),
  nodeModulesDir: resolveNodeModules(),
  /** Loopback port range for generated-app child processes. */
  portPoolStart: num('PORT_POOL_START', 41000),
  portPoolEnd: num('PORT_POOL_END', 41999),
  /** Kill an idle preview after this many ms with no proxy traffic. */
  idleTimeoutMs: num('IDLE_TIMEOUT_MS', 15 * 60 * 1000),
  /** Give a child this long to start listening before declaring an error. */
  startupTimeoutMs: num('STARTUP_TIMEOUT_MS', 15_000),
  /** Heap cap passed to child node processes. */
  childMaxOldSpaceMb: num('CHILD_MAX_OLD_SPACE_MB', 256),
  /** Cap on simultaneously running preview apps. */
  maxConcurrentApps: num('MAX_CONCURRENT_APPS', 12),
  /** Reject persisting a single generated file larger than this. */
  maxFileBytes: num('MAX_FILE_BYTES', 400_000),
  /** Per-file content cap when building model context. */
  contextFileCap: num('CONTEXT_FILE_CAP', 32_000),
  /** Ring-buffer size (lines) for child process logs. */
  logBufferLines: num('LOG_BUFFER_LINES', 2000),
  isProd: process.env.NODE_ENV === 'production',
};

export function dataPath(...segments: string[]): string {
  return resolve(config.dataDir, ...segments);
}
