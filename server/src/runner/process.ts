import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { config } from '../config.js';
import type { LogBuffer } from './logBuffer.js';

/**
 * Spawn a generated app as `node server.js` on the given loopback port.
 *
 * The environment is sanitized: it carries only what the app legitimately
 * needs (PORT, DATA_FILE, a minimal PATH, NODE_PATH fallback). No platform
 * secrets and no BYOK API keys are ever passed to generated code.
 */
export function spawnApp(
  dir: string,
  port: number,
  logs: LogBuffer,
): ChildProcess {
  const env: NodeJS.ProcessEnv = {
    PORT: String(port),
    DATA_FILE: join(dir, 'data.sqlite'),
    NODE_ENV: 'production',
    PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
    NODE_PATH: config.nodeModulesDir,
    HOME: dir,
    // A hint some libraries read; harmless.
    TMPDIR: dir,
  };

  const child = spawn(
    process.execPath,
    [`--max-old-space-size=${config.childMaxOldSpaceMb}`, 'server.js'],
    { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  child.stdout?.on('data', (b: Buffer) => logs.push(b.toString(), 'stdout'));
  child.stderr?.on('data', (b: Buffer) => logs.push(b.toString(), 'stderr'));

  return child;
}

/** Poll the child until it answers HTTP or the startup budget is exhausted. */
export async function waitForListening(
  port: number,
  signal: () => boolean,
): Promise<boolean> {
  const deadline = Date.now() + config.startupTimeoutMs;
  while (Date.now() < deadline) {
    if (signal()) return false; // child already exited
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1000);
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        signal: ctrl.signal,
      });
      clearTimeout(t);
      // Any HTTP response means the server is up and listening.
      if (res.status >= 100) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}
