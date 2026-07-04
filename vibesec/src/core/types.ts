export type Severity = 'critical' | 'high' | 'medium' | 'low';

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export type FindingSource = 'rules' | 'deps' | 'project' | 'auditor';

export type FindingStatus = 'unverified' | 'confirmed' | 'rejected' | 'uncertain';

export interface Finding {
  /** Stable id within a report, e.g. "F3". */
  id: string;
  source: FindingSource;
  /** Rule id for rule-engine findings, e.g. "secrets/aws-access-key-id". */
  ruleId?: string;
  severity: Severity;
  title: string;
  description: string;
  file?: string;
  line?: number;
  snippet?: string;
  cwe?: string;
  fix?: string;
  /** Real-world incident this class of flaw caused, when notable. */
  incident?: string;
  status: FindingStatus;
  /** Verifier confidence in [0, 1] once verified. */
  confidence?: number;
  verifierNote?: string;
}

export interface RuleExample {
  code: string;
  /** File name the example pretends to live in (drives language filters). */
  file: string;
}

export interface Rule {
  id: string;
  category:
    | 'secrets'
    | 'baas'
    | 'injection'
    | 'web'
    | 'crypto'
    | 'filesystem';
  severity: Severity;
  cwe?: string;
  title: string;
  description: string;
  fix: string;
  incident?: string;
  /** File extensions (with dot) the rule applies to; empty/undefined = all text files. */
  extensions?: string[];
  /** Additionally require the file path to match (e.g. Firebase rules files). */
  pathPattern?: RegExp;
  /** Line matches when this pattern matches... */
  pattern: RegExp;
  /** ...unless this one also matches (escape hatch to kill known false positives). */
  negative?: RegExp;
  /** Self-contained test vectors; every rule must detect all vulnerable and no clean examples. */
  examples: { vulnerable: RuleExample[]; clean: RuleExample[] };
}

export interface Patch {
  findingId: string;
  file: string;
  description: string;
  /** Unified diff proposed by the Fixer agent. Never auto-applied. */
  diff: string;
}

export interface ScanStats {
  filesScanned: number;
  filesSkipped: number;
  rulesEvaluated: number;
}

export interface AuditReport {
  projectDir: string;
  /** 'full' ran the agent pipeline; 'scan-only' is the deterministic fallback. */
  mode: 'full' | 'scan-only';
  modeReason?: string;
  findings: Finding[];
  rejected: Finding[];
  patches: Patch[];
  stats: ScanStats;
  warnings: string[];
  generatedAt: string;
}

export function compareBySeverity(a: Finding, b: Finding): number {
  return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
}
