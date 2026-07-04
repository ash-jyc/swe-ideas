import { promises as fs } from 'node:fs';
import path from 'node:path';
import { scanProject, assignFindingIds } from '../core/scanner.js';
import { auditDependencies } from '../core/advisories.js';
import { compareBySeverity, type AuditReport, type Finding, type Patch, type Severity } from '../core/types.js';
import { systemPromptFor } from './definitions.js';
import type { ModelDriver } from './drivers.js';
import { extractJsonObject } from './json.js';

export interface AuditOptions {
  driver?: ModelDriver | null;
  /** Ask the Fixer agent for patches to confirmed findings. */
  fix?: boolean;
  /** Skip agents even if a driver is available. */
  offline?: boolean;
  log?: (message: string) => void;
}

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];
const AUDITOR_CATEGORIES = new Set([
  'access-control',
  'auth',
  'input-validation',
  'rate-limiting',
  'data-exposure',
  'other',
]);

async function buildFileTree(rootDir: string, maxEntries = 400): Promise<string> {
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'venv', '.venv', '__pycache__']);
  const lines: string[] = [];
  async function walk(dir: string, prefix: string): Promise<void> {
    if (lines.length >= maxEntries) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (lines.length >= maxEntries) {
        lines.push(`${prefix}... (truncated)`);
        return;
      }
      if (entry.isDirectory()) {
        if (skip.has(entry.name)) continue;
        lines.push(`${prefix}${entry.name}/`);
        await walk(path.join(dir, entry.name), prefix + '  ');
      } else {
        lines.push(`${prefix}${entry.name}`);
      }
    }
  }
  await walk(rootDir, '');
  return lines.join('\n');
}

function summarizeFinding(f: Finding): string {
  const location = f.file ? `${f.file}${f.line ? `:${f.line}` : ''}` : '(project)';
  const snippet = f.snippet ? ` | code: ${f.snippet}` : '';
  return `- ${f.id} [${f.severity}] ${f.title} @ ${location}${snippet}`;
}

function coerceSeverity(value: unknown): Severity {
  return SEVERITIES.includes(value as Severity) ? (value as Severity) : 'medium';
}

function parseAuditorFindings(raw: unknown, nextIdStart: number): Finding[] {
  const findings: Finding[] = [];
  const list = (raw as { findings?: unknown[] })?.findings;
  if (!Array.isArray(list)) return findings;
  let n = nextIdStart;
  for (const item of list) {
    const f = item as Record<string, unknown>;
    if (typeof f.title !== 'string' || typeof f.description !== 'string') continue;
    const category = AUDITOR_CATEGORIES.has(f.category as string) ? (f.category as string) : 'other';
    findings.push({
      id: `F${n++}`,
      source: 'auditor',
      ruleId: `auditor/${category}`,
      severity: coerceSeverity(f.severity),
      title: f.title,
      description: f.description,
      file: typeof f.file === 'string' ? f.file : undefined,
      line: typeof f.line === 'number' ? f.line : undefined,
      fix: typeof f.fix === 'string' ? f.fix : undefined,
      status: 'unverified',
    });
  }
  return findings;
}

interface Verdict {
  id: string;
  verdict: 'confirmed' | 'rejected' | 'uncertain';
  confidence?: number;
  note?: string;
}

function parseVerdicts(raw: unknown): Verdict[] {
  const list = (raw as { verdicts?: unknown[] })?.verdicts;
  if (!Array.isArray(list)) return [];
  const verdicts: Verdict[] = [];
  for (const item of list) {
    const v = item as Record<string, unknown>;
    if (typeof v.id !== 'string') continue;
    const verdict = v.verdict === 'confirmed' || v.verdict === 'rejected' ? v.verdict : 'uncertain';
    verdicts.push({
      id: v.id,
      verdict,
      confidence: typeof v.confidence === 'number' ? Math.max(0, Math.min(1, v.confidence)) : undefined,
      note: typeof v.note === 'string' ? v.note : undefined,
    });
  }
  return verdicts;
}

function parsePatches(raw: unknown): Patch[] {
  const list = (raw as { patches?: unknown[] })?.patches;
  if (!Array.isArray(list)) return [];
  const patches: Patch[] = [];
  for (const item of list) {
    const p = item as Record<string, unknown>;
    if (typeof p.findingId !== 'string' || typeof p.file !== 'string') continue;
    patches.push({
      findingId: p.findingId,
      file: p.file,
      description: typeof p.description === 'string' ? p.description : '',
      diff: typeof p.diff === 'string' ? p.diff : '',
    });
  }
  return patches;
}

export async function runAudit(projectDir: string, options: AuditOptions = {}): Promise<AuditReport> {
  const log = options.log ?? (() => {});
  const rootDir = path.resolve(projectDir);
  const warnings: string[] = [];

  log('running deterministic scan...');
  const scan = await scanProject(rootDir);
  const depFindings = await auditDependencies(rootDir);
  const baseline = assignFindingIds([...scan.findings, ...depFindings].sort(compareBySeverity));
  log(`baseline: ${baseline.length} finding(s) across ${scan.stats.filesScanned} file(s)`);

  const driver = options.offline ? null : options.driver ?? null;
  let findings: Finding[] = [...baseline];
  let patches: Patch[] = [];
  let mode: AuditReport['mode'] = 'scan-only';
  let modeReason = options.offline
    ? 'offline mode requested; agent pipeline skipped'
    : 'no model driver available (set ANTHROPIC_API_KEY to enable the agent pipeline)';

  if (driver) {
    mode = 'full';
    modeReason = `agent pipeline via ${driver.name}`;

    // Stage 2: Auditor hunts logic flaws the rules can't see (BOLA above all).
    try {
      log('auditor agent: hunting access-control and logic flaws...');
      const tree = await buildFileTree(rootDir);
      const auditorRaw = await driver.run({
        agent: 'auditor',
        systemPrompt: systemPromptFor('auditor'),
        cwd: rootDir,
        prompt: [
          `Project root: ${rootDir}`,
          '',
          'File tree:',
          tree,
          '',
          'Baseline findings already reported by the deterministic scanner (do NOT repeat these):',
          baseline.length ? baseline.map(summarizeFinding).join('\n') : '(none)',
          '',
          'Audit the project now, starting from routes/handlers/API endpoints.',
        ].join('\n'),
      });
      const auditorFindings = parseAuditorFindings(extractJsonObject(auditorRaw), baseline.length + 1);
      log(`auditor: ${auditorFindings.length} additional finding(s)`);
      findings = [...findings, ...auditorFindings];
    } catch (error) {
      warnings.push(`auditor stage failed, continuing with baseline only: ${(error as Error).message}`);
    }

    // Stage 3: Verifier confirms/rejects everything, including the baseline.
    try {
      log('verifier agent: confirming findings against the code...');
      const verifierRaw = await driver.run({
        agent: 'verifier',
        systemPrompt: systemPromptFor('verifier'),
        cwd: rootDir,
        prompt: [
          `Project root: ${rootDir}`,
          '',
          'Candidate findings to verify:',
          findings.map(summarizeFinding).join('\n'),
          '',
          'Read the referenced code and return a verdict for every finding id listed above.',
        ].join('\n'),
      });
      const verdicts = parseVerdicts(extractJsonObject(verifierRaw));
      const byId = new Map(verdicts.map((v) => [v.id, v]));
      for (const finding of findings) {
        const verdict = byId.get(finding.id);
        if (!verdict) {
          finding.status = 'uncertain';
          finding.verifierNote = 'verifier returned no verdict for this finding';
          continue;
        }
        finding.status = verdict.verdict;
        finding.confidence = verdict.confidence;
        finding.verifierNote = verdict.note;
      }
    } catch (error) {
      warnings.push(`verifier stage failed; findings remain unverified: ${(error as Error).message}`);
    }

    // Stage 4: Fixer proposes patches for confirmed findings only.
    const confirmed = findings.filter((f) => f.status === 'confirmed');
    if (options.fix && confirmed.length > 0) {
      try {
        log(`fixer agent: proposing patches for ${confirmed.length} confirmed finding(s)...`);
        const fixerRaw = await driver.run({
          agent: 'fixer',
          systemPrompt: systemPromptFor('fixer'),
          cwd: rootDir,
          prompt: [
            `Project root: ${rootDir}`,
            '',
            'Confirmed findings to patch:',
            confirmed
              .map((f) => `${summarizeFinding(f)}\n  description: ${f.description}\n  suggested direction: ${f.fix ?? 'n/a'}`)
              .join('\n'),
          ].join('\n'),
        });
        patches = parsePatches(extractJsonObject(fixerRaw));
        log(`fixer: ${patches.length} patch(es) proposed`);
      } catch (error) {
        warnings.push(`fixer stage failed; no patches proposed: ${(error as Error).message}`);
      }
    }
  }

  const rejected = findings.filter((f) => f.status === 'rejected');
  const kept = findings.filter((f) => f.status !== 'rejected').sort(compareBySeverity);

  return {
    projectDir: rootDir,
    mode,
    modeReason,
    findings: kept,
    rejected,
    patches,
    stats: scan.stats,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
