// Security-analysis plug-in data model.
//
// The platform ships this interface, a stub analyzer, the storage, the
// endpoints, and the UI. A real AI security agent is plugged in later by
// implementing `SecurityAnalyzer` and calling `registerAnalyzer` at boot —
// no schema, endpoint, or UI changes required.

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

/** A finding as returned by an analyzer, before persistence. */
export interface RawFinding {
  severity: Severity;
  /** e.g. "CWE-89". */
  cwe?: string;
  title: string;
  description: string;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  /** 0..1 analyzer confidence. */
  confidence?: number;
  metadata?: Record<string, unknown>;
}

/** A persisted finding, linked to the project and the turn that produced the code. */
export interface SecurityFinding extends RawFinding {
  id: string;
  projectId: string;
  turnId: string | null;
  analyzer: string;
  createdAt: number;
}

/** Input handed to an analyzer for one analysis run. */
export interface AnalyzerRequest {
  projectId: string;
  /** The turn whose prompt produced this code (research linkage). */
  turnId?: string;
  /** The prompt that produced this code. */
  prompt?: string;
  /** Full file set as of the analyzed turn. */
  files: { path: string; content: string }[];
  /** What this turn changed. */
  diff?: { path: string; unifiedDiff: string }[];
}

export interface AnalyzerResult {
  findings: RawFinding[];
  analyzer: string;
  version: string;
}

export type AnalysisStatus = 'pending' | 'running' | 'complete' | 'error';

export interface AnalysisRun {
  id: string;
  projectId: string;
  turnId: string | null;
  analyzer: string;
  status: AnalysisStatus;
  findingCount: number;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
}

export interface AnalyzerInfo {
  id: string;
  name: string;
  version: string;
}
