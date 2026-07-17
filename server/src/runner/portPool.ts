import net from 'node:net';
import { config } from '../config.js';

const inUse = new Set<number>();

function testBind(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

/** Allocate a free loopback port from the configured range. */
export async function allocatePort(): Promise<number> {
  for (let p = config.portPoolStart; p <= config.portPoolEnd; p++) {
    if (inUse.has(p)) continue;
    if (await testBind(p)) {
      inUse.add(p);
      return p;
    }
  }
  throw new Error('No free ports available in the pool');
}

export function freePort(port: number): void {
  inUse.delete(port);
}

export function activeCount(): number {
  return inUse.size;
}
