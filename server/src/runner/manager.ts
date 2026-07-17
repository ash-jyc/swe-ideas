import type { ChildProcess } from 'node:child_process';
import type { RunState, RunStatus } from '@vibe/shared';
import { config } from '../config.js';
import { allocatePort, freePort, activeCount } from './portPool.js';
import { LogBuffer } from './logBuffer.js';
import { spawnApp, waitForListening } from './process.js';

export interface Instance {
  id: string;
  dir: string;
  persistent: boolean;
  state: RunState;
  port: number | null;
  child: ChildProcess | null;
  logs: LogBuffer;
  message: string | null;
  updatedAt: number;
  lastActivity: number;
  idleTimer: NodeJS.Timeout | null;
  startPromise: Promise<Instance> | null;
  restarts: number;
  exited: boolean;
}

const MAX_RESTARTS = 3;

class AppManager {
  private instances = new Map<string, Instance>();

  get(id: string): Instance | undefined {
    return this.instances.get(id);
  }

  logs(id: string): LogBuffer {
    return this.getOrCreate(id, '').logs;
  }

  status(id: string, projectId: string): RunStatus {
    const inst = this.instances.get(id);
    return {
      projectId,
      state: inst?.state ?? 'idle',
      port: inst?.port ?? null,
      message: inst?.message ?? null,
      updatedAt: inst?.updatedAt ?? Date.now(),
    };
  }

  private getOrCreate(id: string, dir: string): Instance {
    let inst = this.instances.get(id);
    if (!inst) {
      inst = {
        id,
        dir,
        persistent: false,
        state: 'idle',
        port: null,
        child: null,
        logs: new LogBuffer(config.logBufferLines),
        message: null,
        updatedAt: Date.now(),
        lastActivity: Date.now(),
        idleTimer: null,
        startPromise: null,
        restarts: 0,
        exited: false,
      };
      this.instances.set(id, inst);
    } else if (dir) {
      inst.dir = dir;
    }
    return inst;
  }

  private setState(inst: Instance, state: RunState, message?: string): void {
    inst.state = state;
    inst.message = message ?? null;
    inst.updatedAt = Date.now();
  }

  touch(id: string): void {
    const inst = this.instances.get(id);
    if (!inst) return;
    inst.lastActivity = Date.now();
    this.scheduleIdle(inst);
  }

  private scheduleIdle(inst: Instance): void {
    if (inst.idleTimer) clearTimeout(inst.idleTimer);
    if (inst.persistent) return;
    inst.idleTimer = setTimeout(() => {
      if (inst.state === 'running') {
        inst.logs.push('[platform] idle timeout — stopping preview', 'system');
        void this.stop(inst.id);
      }
    }, config.idleTimeoutMs);
  }

  /** If already running, return it; otherwise materialize and launch. */
  async ensureRunning(
    id: string,
    dir: string,
    persistent: boolean,
    materialize: () => void,
  ): Promise<Instance> {
    const inst = this.getOrCreate(id, dir);
    if (inst.state === 'running' && inst.child && !inst.exited) {
      this.touch(id);
      return inst;
    }
    if (inst.startPromise) return inst.startPromise;
    materialize();
    return this.launch(id, dir, persistent);
  }

  /** Stop any existing child and start a fresh one from `dir`. */
  async launch(id: string, dir: string, persistent: boolean): Promise<Instance> {
    const inst = this.getOrCreate(id, dir);
    inst.persistent = persistent;
    if (inst.startPromise) await inst.startPromise.catch(() => {});
    await this.stopChild(inst);
    inst.restarts = 0;
    const p = this.start(inst);
    inst.startPromise = p;
    try {
      return await p;
    } finally {
      inst.startPromise = null;
    }
  }

  private async start(inst: Instance): Promise<Instance> {
    await this.evictIfNeeded(inst.id, inst.persistent);
    this.setState(inst, 'starting');
    inst.exited = false;
    inst.logs.push('[platform] starting app…', 'system');

    let port: number;
    try {
      port = await allocatePort();
    } catch (e) {
      this.setState(inst, 'error', 'no free ports');
      return inst;
    }
    inst.port = port;

    const child = spawnApp(inst.dir, port, inst.logs);
    inst.child = child;

    child.on('exit', (code, signal) => {
      inst.exited = true;
      inst.child = null;
      if (inst.port != null) {
        freePort(inst.port);
      }
      if (inst.state === 'stopping') {
        this.setState(inst, 'idle');
        inst.port = null;
        return;
      }
      inst.logs.push(
        `[platform] app exited (code ${code ?? 'null'}${signal ? ', ' + signal : ''})`,
        'system',
      );
      this.setState(inst, 'crashed', `exited with code ${code ?? 'null'}`);
      inst.port = null;
    });

    const ok = await waitForListening(port, () => inst.exited);
    if (!ok) {
      if (!inst.exited) {
        this.setState(inst, 'error', 'app did not start listening in time');
        await this.stopChild(inst);
      }
      return inst;
    }

    this.setState(inst, 'running');
    inst.logs.push(`[platform] app is running on internal port ${port}`, 'system');
    this.touch(inst.id);
    return inst;
  }

  private async stopChild(inst: Instance): Promise<void> {
    if (inst.idleTimer) {
      clearTimeout(inst.idleTimer);
      inst.idleTimer = null;
    }
    const child = inst.child;
    if (!child) return;
    this.setState(inst, 'stopping');
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      child.once('exit', finish);
      try {
        child.kill('SIGTERM');
      } catch {
        finish();
      }
      setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* ignore */
        }
        finish();
      }, 2000);
    });
    inst.child = null;
  }

  async stop(id: string): Promise<void> {
    const inst = this.instances.get(id);
    if (!inst) return;
    await this.stopChild(inst);
    if (inst.port != null) {
      freePort(inst.port);
      inst.port = null;
    }
    this.setState(inst, 'idle');
  }

  private async evictIfNeeded(exceptId: string, persistent: boolean): Promise<void> {
    if (persistent) return;
    if (activeCount() < config.maxConcurrentApps) return;
    let victim: Instance | null = null;
    for (const inst of this.instances.values()) {
      if (inst.id === exceptId || inst.persistent) continue;
      if (inst.state !== 'running') continue;
      if (!victim || inst.lastActivity < victim.lastActivity) victim = inst;
    }
    if (victim) {
      victim.logs.push('[platform] evicted to free a slot', 'system');
      await this.stop(victim.id);
    }
  }

  /** Stop every running child (used on graceful shutdown). */
  async stopAll(): Promise<void> {
    await Promise.all([...this.instances.keys()].map((id) => this.stop(id)));
  }
}

export const appManager = new AppManager();

export const previewId = (projectId: string) => `preview:${projectId}`;
export const siteId = (slug: string) => `site:${slug}`;
