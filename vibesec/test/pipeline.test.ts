import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runAudit } from '../src/agents/pipeline.js';
import { ScriptedDriver, type AgentTask } from '../src/agents/drivers.js';
import { extractJsonObject } from '../src/agents/json.js';
import { renderReport } from '../src/report/markdown.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/vulnerable-app', import.meta.url));

const BOLA_FINDING = {
  title: 'BOLA: any user can read or delete any document',
  severity: 'critical',
  file: 'server/routes/documents.js',
  line: 11,
  description:
    'GET/DELETE /documents/:id trust the id from the URL and never check that the authenticated user owns the document.',
  fix: 'Add an ownership check: WHERE id = $1 AND owner_id = $2 with the authenticated user id.',
  category: 'access-control',
};

/** Pull the finding ids the pipeline listed in an agent prompt. */
function idsInPrompt(prompt: string): string[] {
  return [...prompt.matchAll(/^- (F\d+) \[/gm)].map((m) => m[1]!);
}

describe('runAudit offline (scan-only)', () => {
  it('returns the deterministic baseline without any driver', async () => {
    const report = await runAudit(FIXTURE, { offline: true });
    expect(report.mode).toBe('scan-only');
    expect(report.findings.length).toBeGreaterThan(10);
    expect(report.findings.every((f) => f.status === 'unverified')).toBe(true);
    expect(report.rejected).toHaveLength(0);
    // severity-sorted: first finding must be critical
    expect(report.findings[0]!.severity).toBe('critical');
    // dependency findings are merged in
    expect(report.findings.some((f) => f.source === 'deps')).toBe(true);
  });
});

describe('runAudit full pipeline (scripted driver)', () => {
  function makeDriver(): ScriptedDriver {
    return new ScriptedDriver({
      // The Auditor reports the planted BOLA flaw the rules cannot see,
      // wrapped in prose + fence to exercise JSON extraction.
      auditor: [
        `Here is my analysis:\n\`\`\`json\n${JSON.stringify({ findings: [BOLA_FINDING] })}\n\`\`\``,
      ],
      // The Verifier confirms everything except the hardcoded-password
      // finding, which it rejects as a false positive.
      verifier: [
        (task: AgentTask) => {
          const verdicts = idsInPrompt(task.prompt).map((id) => {
            const line = task.prompt.split('\n').find((l) => l.startsWith(`- ${id} `))!;
            if (line.includes('Hardcoded password')) {
              return { id, verdict: 'rejected', confidence: 0.9, note: 'value is a non-production default' };
            }
            return { id, verdict: 'confirmed', confidence: 0.95, note: 'verified against the code' };
          });
          return JSON.stringify({ verdicts });
        },
      ],
      // The Fixer patches the first confirmed finding it is given.
      fixer: [
        (task: AgentTask) => {
          const first = idsInPrompt(task.prompt)[0]!;
          return JSON.stringify({
            patches: [
              {
                findingId: first,
                file: 'server/routes/documents.js',
                description: 'Add ownership check to document queries.',
                diff: '--- a/server/routes/documents.js\n+++ b/server/routes/documents.js\n@@ -1 +1 @@\n-old\n+new\n',
              },
            ],
          });
        },
      ],
    });
  }

  it('runs auditor -> verifier and merges verdicts', async () => {
    const driver = makeDriver();
    const report = await runAudit(FIXTURE, { driver });

    expect(report.mode).toBe('full');
    expect(driver.calls.map((c) => c.agent)).toEqual(['auditor', 'verifier']);

    // The BOLA finding the rules cannot see is present, confirmed, and critical.
    const bola = report.findings.find((f) => f.source === 'auditor');
    expect(bola).toBeDefined();
    expect(bola!.title).toContain('BOLA');
    expect(bola!.ruleId).toBe('auditor/access-control');
    expect(bola!.status).toBe('confirmed');

    // The planted false positive was rejected and removed from findings.
    expect(report.rejected).toHaveLength(1);
    expect(report.rejected[0]!.ruleId).toBe('secrets/hardcoded-password');
    expect(report.findings.some((f) => f.ruleId === 'secrets/hardcoded-password')).toBe(false);

    // Everything kept is confirmed, with verifier metadata attached.
    expect(report.findings.every((f) => f.status === 'confirmed')).toBe(true);
    expect(report.findings[0]!.confidence).toBe(0.95);
    expect(report.warnings).toHaveLength(0);
  });

  it('asks the Fixer for patches when fix is enabled', async () => {
    const driver = makeDriver();
    const report = await runAudit(FIXTURE, { driver, fix: true });
    expect(driver.calls.map((c) => c.agent)).toEqual(['auditor', 'verifier', 'fixer']);
    expect(report.patches).toHaveLength(1);
    expect(report.patches[0]!.diff).toContain('+++ b/server/routes/documents.js');
  });

  it('the auditor prompt carries the file tree and baseline, and asks not to repeat it', async () => {
    const driver = makeDriver();
    await runAudit(FIXTURE, { driver });
    const auditorPrompt = driver.calls[0]!.prompt;
    expect(auditorPrompt).toContain('documents.js');
    expect(auditorPrompt).toContain('do NOT repeat');
    expect(idsInPrompt(auditorPrompt).length).toBeGreaterThan(10);
  });

  it('degrades gracefully when the auditor returns garbage', async () => {
    const driver = new ScriptedDriver({
      auditor: ['I could not produce JSON, sorry!'],
      verifier: [
        (task: AgentTask) =>
          JSON.stringify({
            verdicts: idsInPrompt(task.prompt).map((id) => ({ id, verdict: 'confirmed', confidence: 0.8 })),
          }),
      ],
    });
    const report = await runAudit(FIXTURE, { driver });
    expect(report.warnings.some((w) => w.includes('auditor stage failed'))).toBe(true);
    // baseline still verified and reported
    expect(report.findings.length).toBeGreaterThan(10);
    expect(report.findings.every((f) => f.status === 'confirmed')).toBe(true);
  });
});

describe('extractJsonObject', () => {
  it('parses bare JSON', () => {
    expect(extractJsonObject('{"a": 1}')).toEqual({ a: 1 });
  });
  it('parses fenced JSON with prose around it', () => {
    expect(extractJsonObject('Sure!\n```json\n{"a": [1, 2]}\n```\nDone.')).toEqual({ a: [1, 2] });
  });
  it('parses an embedded object with braces in strings', () => {
    expect(extractJsonObject('result: {"a": "with { brace and \\" quote"} trailing')).toEqual({
      a: 'with { brace and " quote',
    });
  });
  it('throws on hopeless input', () => {
    expect(() => extractJsonObject('no json here')).toThrow(/could not extract JSON/);
  });
});

describe('renderReport', () => {
  it('renders a scan-only report with hardened prompt suggestions', async () => {
    const report = await runAudit(FIXTURE, { offline: true });
    const markdown = renderReport(report);
    expect(markdown).toContain('# VibeSec Security Audit');
    expect(markdown).toContain('CRITICAL');
    expect(markdown).toContain('Harden your next prompt');
    expect(markdown).toContain('Row Level Security');
    expect(markdown).toContain('deterministic scan only');
  });

  it('renders verifier results and rejected findings in full mode', async () => {
    const driver = makeFullDriver();
    const report = await runAudit(FIXTURE, { driver });
    const markdown = renderReport(report);
    expect(markdown).toContain('Rejected as false positives');
    expect(markdown).toContain('BOLA');
    expect(markdown).toContain('confidence 0.95');
  });

  function makeFullDriver(): ScriptedDriver {
    return new ScriptedDriver({
      auditor: [JSON.stringify({ findings: [BOLA_FINDING] })],
      verifier: [
        (task: AgentTask) =>
          JSON.stringify({
            verdicts: idsInPrompt(task.prompt).map((id) => {
              const line = task.prompt.split('\n').find((l) => l.startsWith(`- ${id} `))!;
              return line.includes('Hardcoded password')
                ? { id, verdict: 'rejected', confidence: 0.9, note: 'test default, not a real credential' }
                : { id, verdict: 'confirmed', confidence: 0.95, note: 'verified' };
            }),
          }),
      ],
    });
  }
});
