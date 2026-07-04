import type { AuditReport, Finding, Severity } from '../core/types.js';
import { hardenedPromptLines } from './hardenedPrompt.js';

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: '🟥 CRITICAL',
  high: '🟧 HIGH',
  medium: '🟨 MEDIUM',
  low: '🟦 LOW',
};

function renderFinding(f: Finding): string {
  const lines: string[] = [];
  const location = f.file ? ` — \`${f.file}${f.line ? `:${f.line}` : ''}\`` : '';
  lines.push(`### ${f.id}: ${f.title}${location}`);
  lines.push('');
  const meta: string[] = [SEVERITY_LABEL[f.severity]];
  if (f.cwe) meta.push(f.cwe);
  meta.push(`source: ${f.source}`);
  if (f.status !== 'unverified') {
    meta.push(f.confidence !== undefined ? `${f.status} (confidence ${f.confidence.toFixed(2)})` : f.status);
  }
  lines.push(`**${meta.join(' · ')}**`);
  lines.push('');
  if (f.snippet) {
    lines.push('```');
    lines.push(f.snippet);
    lines.push('```');
    lines.push('');
  }
  lines.push(f.description);
  lines.push('');
  if (f.fix) {
    lines.push(`**Fix:** ${f.fix}`);
    lines.push('');
  }
  if (f.verifierNote) {
    lines.push(`> Verifier: ${f.verifierNote}`);
    lines.push('');
  }
  if (f.incident) {
    lines.push(`> ⚠️ Seen in the wild: ${f.incident}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function renderReport(report: AuditReport): string {
  const lines: string[] = [];
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of report.findings) counts[f.severity]++;

  lines.push('# VibeSec Security Audit');
  lines.push('');
  lines.push(`- **Project:** \`${report.projectDir}\``);
  lines.push(`- **Mode:** ${report.mode}${report.modeReason ? ` (${report.modeReason})` : ''}`);
  lines.push(`- **Generated:** ${report.generatedAt}`);
  lines.push(
    `- **Scanned:** ${report.stats.filesScanned} file(s) against ${report.stats.rulesEvaluated} rules (${report.stats.filesSkipped} skipped)`,
  );
  lines.push('');
  lines.push(
    `**Findings: ${report.findings.length}** — ` +
      `${counts.critical} critical · ${counts.high} high · ${counts.medium} medium · ${counts.low} low` +
      (report.rejected.length ? ` (${report.rejected.length} rejected as false positives)` : ''),
  );
  lines.push('');

  if (report.warnings.length) {
    lines.push('> ⚠️ ' + report.warnings.join('\n> ⚠️ '));
    lines.push('');
  }

  if (report.mode === 'scan-only') {
    lines.push(
      '> This was a deterministic scan only. Run with an `ANTHROPIC_API_KEY` to add the agent pipeline: an Auditor that hunts broken access control (the flaw class behind the Lovable/Tea/Moltbook breaches), a Verifier that removes false positives, and an optional Fixer that drafts patches.',
    );
    lines.push('');
  }

  for (const severity of ['critical', 'high', 'medium', 'low'] as Severity[]) {
    const group = report.findings.filter((f) => f.severity === severity);
    if (group.length === 0) continue;
    lines.push(`## ${SEVERITY_LABEL[severity]} (${group.length})`);
    lines.push('');
    for (const finding of group) {
      lines.push(renderFinding(finding));
    }
  }

  if (report.findings.length === 0) {
    lines.push('## No findings 🎉');
    lines.push('');
    lines.push(
      'The deterministic rules and agents found nothing to report. That is evidence, not proof — keep secrets in env vars and authorization on the server.',
    );
    lines.push('');
  }

  if (report.patches.length) {
    lines.push('## Proposed patches (review before applying)');
    lines.push('');
    for (const patch of report.patches) {
      lines.push(`### ${patch.findingId} — \`${patch.file}\``);
      lines.push('');
      lines.push(patch.description);
      lines.push('');
      if (patch.diff.trim()) {
        lines.push('```diff');
        lines.push(patch.diff.trimEnd());
        lines.push('```');
        lines.push('');
      }
    }
  }

  const promptLines = hardenedPromptLines(report.findings);
  if (promptLines.length) {
    lines.push('## Harden your next prompt');
    lines.push('');
    lines.push(
      'These flaws exist because the original prompts never asked for security. Paste this block into your AI coding assistant for every future feature:',
    );
    lines.push('');
    lines.push('```text');
    lines.push('Security requirements (non-negotiable):');
    for (const line of promptLines) {
      lines.push(`- ${line}`);
    }
    lines.push('```');
    lines.push('');
  }

  if (report.rejected.length) {
    lines.push('## Rejected as false positives');
    lines.push('');
    for (const f of report.rejected) {
      lines.push(`- **${f.id}** ${f.title} (\`${f.file ?? 'project'}\`) — ${f.verifierNote ?? 'rejected by verifier'}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
