// Server-sent event union for the streaming /generate endpoint.

import type { TokenUsage } from './providers.js';
import type { RunState } from './domain.js';

export type GenerateEvent =
  | { type: 'turn-start'; turnId: string; seq: number }
  /** Raw prose delta from the model (outside file-op blocks). */
  | { type: 'token'; text: string }
  /** A file-op block began streaming. */
  | { type: 'file-open'; path: string }
  /** A file-op block finished (write) or a delete was parsed. */
  | { type: 'file-op'; op: 'write' | 'delete'; path: string }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'run-status'; state: RunState; message?: string }
  | { type: 'done'; turnId: string; fileCount: number }
  | { type: 'error'; message: string };

/** A single log line streamed from a running app child process. */
export interface RunLogEvent {
  line: string;
  stream: 'stdout' | 'stderr' | 'system';
  ts: number;
}
