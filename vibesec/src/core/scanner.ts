import { promises as fs } from 'node:fs';
import path from 'node:path';
import { allRules } from './rules/index.js';
import type { Finding, Rule, ScanStats } from './types.js';

const DEFAULT_EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.svelte-kit',
  'coverage',
  'vendor',
  'venv',
  '.venv',
  '__pycache__',
  '.cache',
  'vibesec-fixes',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
  '.pdf', '.zip', '.gz', '.tar', '.tgz', '.7z',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.mov', '.avi', '.webm',
  '.jar', '.class', '.pyc', '.so', '.dylib', '.dll', '.exe',
  '.min.js', '.map', '.lock',
]);

const MAX_FILE_SIZE = 512 * 1024;
const MAX_LINE_LENGTH = 1000; // longer lines are almost always minified/generated

export interface ScanOptions {
  excludeDirs?: string[];
}

export interface ScanResult {
  findings: Finding[];
  stats: ScanStats;
}

function ruleApplies(rule: Rule, relPath: string): boolean {
  if (rule.pathPattern && !rule.pathPattern.test(relPath)) return false;
  if (rule.extensions && rule.extensions.length > 0) {
    const ext = path.extname(relPath).toLowerCase();
    if (!rule.extensions.includes(ext)) return false;
  }
  return true;
}

function makeFinding(rule: Rule, relPath: string, lineNo: number, line: string): Finding {
  return {
    id: '',
    source: 'rules',
    ruleId: rule.id,
    severity: rule.severity,
    title: rule.title,
    description: rule.description,
    file: relPath,
    line: lineNo,
    snippet: line.trim().slice(0, 240),
    cwe: rule.cwe,
    fix: rule.fix,
    incident: rule.incident,
    status: 'unverified',
  };
}

/** Apply every applicable rule to one file's content. Exported for tests and rule vectors. */
export function scanContent(relPath: string, content: string, rules: Rule[] = allRules): Finding[] {
  const findings: Finding[] = [];
  const applicable = rules.filter((r) => ruleApplies(r, relPath));
  if (applicable.length === 0) return findings;

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.length > MAX_LINE_LENGTH) continue;
    for (const rule of applicable) {
      if (!rule.pattern.test(line)) continue;
      if (rule.negative && rule.negative.test(line)) continue;
      findings.push(makeFinding(rule, relPath, i + 1, line));
    }
  }
  findings.push(...projectChecksForFile(relPath, content));
  return findings;
}

const ENV_FILE = /^\.env(?:\..+)?$/;
const ENV_FILE_SAFE = /example|sample|template|\.test$|\.d\.ts$/i;
const WEBHOOK_ROUTE =
  /(?:app|router|server)\.(?:post|put|all)\s*\(\s*["'`][^"'`]*webhook|@(?:app|bp)\.route\s*\(\s*["'][^"']*webhook/i;
const WEBHOOK_VERIFICATION =
  /signature|verify|hmac|svix|constructEvent|X-Hub-Signature|timingSafeEqual|webhook_secret|WEBHOOK_SECRET/i;

/** Whole-file heuristics that don't fit the per-line rule model. */
function projectChecksForFile(relPath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const base = path.basename(relPath);

  if (ENV_FILE.test(base) && !ENV_FILE_SAFE.test(base)) {
    const hasValues = content
      .split(/\r?\n/)
      .some((l) => /^[A-Za-z_][A-Za-z0-9_]*\s*=\s*\S/.test(l.trim()) && !l.trim().startsWith('#'));
    if (hasValues) {
      findings.push({
        id: '',
        source: 'project',
        ruleId: 'project/committed-env-file',
        severity: 'critical',
        title: 'Environment file with values committed to the repository',
        description:
          'A .env file containing real key=value pairs is in the repo. Anyone with read access to the code (or the git history) gets every secret in it.',
        file: relPath,
        cwe: 'CWE-538',
        fix: 'Delete it from the repo AND from git history, rotate every value, add .env to .gitignore, and commit a .env.example with empty values instead.',
        incident:
          '60%+ of vibe-coded apps assessed in Q1 2026 exposed API keys or database credentials in public repositories.',
        status: 'unverified',
      });
    }
  }

  if (WEBHOOK_ROUTE.test(content) && !WEBHOOK_VERIFICATION.test(content)) {
    findings.push({
      id: '',
      source: 'project',
      ruleId: 'project/webhook-no-signature-check',
      severity: 'medium',
      title: 'Webhook endpoint without signature verification',
      description:
        'This file defines a webhook route but never references a signature/HMAC check. Anyone who finds the URL can forge webhook events (fake payments, fake deploys...).',
      file: relPath,
      cwe: 'CWE-345',
      fix: "Verify the provider's signature header (e.g. stripe.webhooks.constructEvent, svix.verify, HMAC compare with timingSafeEqual) before trusting the payload.",
      status: 'unverified',
    });
  }

  return findings;
}

function shouldSkipFile(relPath: string, size: number): boolean {
  if (size > MAX_FILE_SIZE) return true;
  const base = path.basename(relPath).toLowerCase();
  if (base.endsWith('.min.js') || base.endsWith('.min.css')) return true;
  const ext = path.extname(base);
  if (BINARY_EXTENSIONS.has(ext)) return true;
  return false;
}

async function* walk(dir: string, root: string, excludeDirs: Set<string>): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (excludeDirs.has(entry.name)) continue;
      yield* walk(full, root, excludeDirs);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

/** Scan a project directory with the full rule set. Findings come back without ids. */
export async function scanProject(rootDir: string, options: ScanOptions = {}): Promise<ScanResult> {
  const root = path.resolve(rootDir);
  const excludeDirs = new Set([...DEFAULT_EXCLUDED_DIRS, ...(options.excludeDirs ?? [])]);
  const findings: Finding[] = [];
  const stats: ScanStats = { filesScanned: 0, filesSkipped: 0, rulesEvaluated: allRules.length };

  for await (const filePath of walk(root, root, excludeDirs)) {
    const relPath = path.relative(root, filePath).split(path.sep).join('/');
    const stat = await fs.stat(filePath);
    if (shouldSkipFile(relPath, stat.size)) {
      stats.filesSkipped++;
      continue;
    }
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch {
      stats.filesSkipped++;
      continue;
    }
    if (content.includes('\0')) {
      stats.filesSkipped++;
      continue;
    }
    stats.filesScanned++;
    findings.push(...scanContent(relPath, content));
  }

  return { findings, stats };
}

/** Assign stable report ids (F1, F2, ...) in severity order. */
export function assignFindingIds(findings: Finding[]): Finding[] {
  let n = 0;
  for (const f of findings) {
    n += 1;
    f.id = `F${n}`;
  }
  return findings;
}
