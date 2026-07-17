import type {
  Project,
  ProjectDetail,
  ProjectFileTree,
  Turn,
  TurnDetail,
  TurnDiffResponse,
  RunStatus,
  Deployment,
  SecurityFinding,
  AnalysisRun,
  AnalyzerInfo,
  GithubExportResponse,
} from '@vibe/shared';

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

const jsonHeaders = { 'content-type': 'application/json' };

export type ProjectSummary = Project & { findingCount: number; runStatus: string };

export const api = {
  listProjects: () => fetch('/api/projects').then(j<ProjectSummary[]>),
  createProject: (name: string, description?: string) =>
    fetch('/api/projects', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ name, description }),
    }).then(j<Project>),
  getProject: (id: string) => fetch(`/api/projects/${id}`).then(j<ProjectDetail>),
  deleteProject: (id: string) =>
    fetch(`/api/projects/${id}`, { method: 'DELETE' }).then(j<{ ok: true }>),

  getFiles: (id: string) => fetch(`/api/projects/${id}/files`).then(j<ProjectFileTree>),
  getFile: (id: string, path: string) =>
    fetch(`/api/projects/${id}/files/content?path=${encodeURIComponent(path)}`).then(
      j<{ path: string; content: string }>,
    ),
  saveFile: (id: string, path: string, content: string) =>
    fetch(`/api/projects/${id}/files/content`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ path, content }),
    }).then(j<{ ok: true }>),

  listTurns: (id: string) => fetch(`/api/projects/${id}/turns`).then(j<Turn[]>),
  getTurn: (id: string, turnId: string) =>
    fetch(`/api/projects/${id}/turns/${turnId}`).then(j<TurnDetail>),
  getTurnDiff: (id: string, turnId: string) =>
    fetch(`/api/projects/${id}/turns/${turnId}/diff`).then(j<TurnDiffResponse>),

  run: (id: string) => fetch(`/api/projects/${id}/run`, { method: 'POST' }).then(j<RunStatus>),
  stop: (id: string) => fetch(`/api/projects/${id}/stop`, { method: 'POST' }).then(j<RunStatus>),
  runStatus: (id: string) => fetch(`/api/projects/${id}/run/status`).then(j<RunStatus>),

  deploy: (id: string, slug?: string) =>
    fetch(`/api/projects/${id}/deploy`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ slug }),
    }).then(j<Deployment & { url: string }>),
  deployments: (id: string) =>
    fetch(`/api/projects/${id}/deployments`).then(j<(Deployment & { url: string })[]>),

  analyze: (id: string, turnId?: string, analyzer?: string) =>
    fetch(`/api/projects/${id}/analyze`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ turnId, analyzer }),
    }).then(j<AnalysisRun>),
  findings: (id: string, turnId?: string) =>
    fetch(
      `/api/projects/${id}/findings${turnId ? `?turnId=${turnId}` : ''}`,
    ).then(j<SecurityFinding[]>),
  analysisRun: (runId: string) =>
    fetch(`/api/analysis-runs/${runId}`).then(j<AnalysisRun>),
  analyzers: () => fetch('/api/analyzers').then(j<AnalyzerInfo[]>),

  githubExport: (
    id: string,
    token: string,
    repoName: string,
    isPrivate: boolean,
    description?: string,
  ) =>
    fetch(`/api/projects/${id}/github/export`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ token, repoName, private: isPrivate, description }),
    }).then(j<GithubExportResponse>),
};
