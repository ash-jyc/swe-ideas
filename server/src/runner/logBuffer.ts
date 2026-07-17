import type { RunLogEvent } from '@vibe/shared';

type Listener = (e: RunLogEvent) => void;

/** Capped ring buffer of log lines per app, with live SSE fan-out. */
export class LogBuffer {
  private lines: RunLogEvent[] = [];
  private listeners = new Set<Listener>();

  constructor(private cap: number) {}

  push(text: string, stream: RunLogEvent['stream']): void {
    for (const raw of text.split(/\r?\n/)) {
      if (raw === '') continue;
      const e: RunLogEvent = { line: raw, stream, ts: Date.now() };
      this.lines.push(e);
      if (this.lines.length > this.cap) this.lines.shift();
      for (const fn of this.listeners) fn(e);
    }
  }

  snapshot(): RunLogEvent[] {
    return [...this.lines];
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  clear(): void {
    this.lines = [];
  }
}
