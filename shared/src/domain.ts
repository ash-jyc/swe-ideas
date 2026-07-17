// Core domain entities persisted by the platform.

import type { TokenUsage } from './providers.js';

export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  createdAt: number;
  updatedAt: number;
}

export type TurnStatus = 'streaming' | 'complete' | 'error';

export interface Turn {
  id: string;
  projectId: string;
  seq: number;
  prompt: string;
  /** Full, unparsed model output — the primary research artifact. */
  rawResponse: string;
  /** Human-readable prose the model emitted outside file-op blocks. */
  summary: string | null;
  provider: string;
  model: string;
  baseUrl: string | null;
  usage: TokenUsage;
  promptVersion: string;
  status: TurnStatus;
  error: string | null;
  createdAt: number;
  completedAt: number | null;
}

export type FileOpKind = 'write' | 'delete';

export interface TurnFileOp {
  id: string;
  turnId: string;
  path: string;
  op: FileOpKind;
  /** Full file content after the op (null for deletes). */
  contentAfter: string | null;
  /** Unified diff vs the previous snapshot of this path. */
  unifiedDiff: string | null;
  createdAt: number;
}

export interface ProjectFile {
  path: string;
  content: string;
  updatedTurn: string | null;
  updatedAt: number;
}

export type RunState =
  | 'idle'
  | 'materializing'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'crashed'
  | 'error';

export interface RunStatus {
  projectId: string;
  state: RunState;
  /** Loopback port the child listens on (never exposed directly). */
  port: number | null;
  message: string | null;
  updatedAt: number;
}

export type DeploymentStatus = 'building' | 'live' | 'stopped' | 'error';

export interface Deployment {
  id: string;
  projectId: string;
  slug: string;
  turnId: string | null;
  status: DeploymentStatus;
  createdAt: number;
  updatedAt: number;
}
