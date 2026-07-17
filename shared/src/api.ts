// Request/response DTOs for the REST API surface.

import type { ByokCredentials } from './providers.js';
import type {
  Project,
  Turn,
  TurnFileOp,
  RunStatus,
  Deployment,
} from './domain.js';
import type { ProjectFileTree } from './codegen.js';
import type { SecurityFinding, AnalysisRun, AnalyzerInfo } from './findings.js';

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface ProjectDetail extends Project {
  fileTree: ProjectFileTree;
  latestTurnSeq: number;
  runStatus: RunStatus;
  findingCount: number;
}

export interface FileContentResponse {
  path: string;
  content: string;
}

export interface GenerateRequest {
  prompt: string;
  credentials: ByokCredentials;
}

export interface TurnDetail extends Turn {
  ops: TurnFileOp[];
}

export interface TurnDiffResponse {
  files: {
    path: string;
    op: 'write' | 'delete';
    unifiedDiff: string;
    before: string;
    after: string;
  }[];
}

export interface DeployRequest {
  slug?: string;
}

export interface GithubExportRequest {
  token: string;
  repoName: string;
  private?: boolean;
  description?: string;
}

export interface GithubExportResponse {
  repoUrl: string;
  commitSha: string;
}

export interface AnalyzeRequest {
  turnId?: string;
  analyzer?: string;
}

// Convenience re-exports of the response shapes used by the typed client.
export type {
  Project,
  Turn,
  RunStatus,
  Deployment,
  SecurityFinding,
  AnalysisRun,
  AnalyzerInfo,
};
