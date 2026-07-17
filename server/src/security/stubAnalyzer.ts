import type {
  AnalyzerRequest,
  AnalyzerResult,
  RawFinding,
  Severity,
} from '@vibe/shared';
import type { SecurityAnalyzer } from './analyzer.js';

// ---------------------------------------------------------------------------
// PLACEHOLDER ANALYZER.
//
// This is a cheap line-based heuristic scanner whose only job is to exercise
// the full analysis pipeline (endpoint → analyzer → findings → UI) end-to-end
// with real file/line data. It is NOT a serious security tool and will both
// miss real issues and flag benign code.
//
// Replace it by implementing `SecurityAnalyzer` (e.g. an LLM agent using the
// user's BYOK credentials) and calling `registerAnalyzer(myAnalyzer, true)` in
// server bootstrap. See docs/security-analyzer.md.
// ---------------------------------------------------------------------------

interface Rule {
  id: string;
  test: RegExp;
  severity: Severity;
  cwe: string;
  title: string;
  description: string;
  /** Only apply to files matching this, if set. */
  fileMatch?: RegExp;
}

const RULES: Rule[] = [
  {
    id: 'sql-concat',
    test: /(SELECT|INSERT|UPDATE|DELETE)\b[\s\S]{0,120}?(["'`][\s\S]{0,60}?\+|\$\{)/i,
    severity: 'high',
    cwe: 'CWE-89',
    title: 'Possible SQL injection (string-built query)',
    description:
      'A SQL statement appears to be assembled from string concatenation or template interpolation rather than parameterized bindings, which can allow SQL injection.',
  },
  {
    id: 'cmd-injection',
    test: /(exec|execSync|spawn|execFile)\s*\([^)]*(\+|\$\{|`)/,
    severity: 'critical',
    cwe: 'CWE-78',
    title: 'Possible OS command injection',
    description:
      'A child-process call is built from concatenated or interpolated input, which can allow arbitrary command execution.',
  },
  {
    id: 'reflected-xss',
    test: /res\.(send|write|end)\s*\([^)]*(\+|\$\{)[^)]*req\./,
    severity: 'high',
    cwe: 'CWE-79',
    title: 'Possible reflected XSS',
    description:
      'User-controlled request data is written into an HTML response without encoding, which can allow cross-site scripting.',
  },
  {
    id: 'dom-xss',
    test: /\.innerHTML\s*(=|\+=)\s*[^;]*(\+|\$\{|\bawait\b|\bfetch\b|response|data|rows|json)/,
    severity: 'medium',
    cwe: 'CWE-79',
    title: 'Possible DOM-based XSS',
    description:
      'A value derived from data is assigned to innerHTML, which can execute injected markup/script in the browser.',
    fileMatch: /\.(js|html)$/,
  },
  {
    id: 'hardcoded-secret',
    test: /(secret|password|api[_-]?key|token|private[_-]?key)\s*[:=]\s*["'][^"']{6,}["']/i,
    severity: 'medium',
    cwe: 'CWE-798',
    title: 'Hardcoded secret',
    description:
      'A credential or secret appears to be hardcoded in source, which risks exposure if the code is shared or committed.',
  },
  {
    id: 'weak-jwt',
    test: /jwt\.sign\s*\([^)]*,\s*["'][^"']+["']/,
    severity: 'medium',
    cwe: 'CWE-798',
    title: 'JWT signed with a hardcoded secret',
    description:
      'A JWT is signed using a literal secret embedded in source rather than a configured, rotated secret.',
  },
];

function scanFile(path: string, content: string): RawFinding[] {
  const findings: RawFinding[] = [];
  const lines = content.split('\n');
  for (const rule of RULES) {
    if (rule.fileMatch && !rule.fileMatch.test(path)) continue;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (rule.test.test(line)) {
        findings.push({
          severity: rule.severity,
          cwe: rule.cwe,
          title: rule.title,
          description: rule.description,
          file: path,
          lineStart: i + 1,
          lineEnd: i + 1,
          confidence: 0.5,
          metadata: { rule: rule.id, snippet: line.trim().slice(0, 200) },
        });
      }
    }
  }
  return findings;
}

export const stubAnalyzer: SecurityAnalyzer = {
  id: 'stub-heuristic',
  name: 'Heuristic pattern scanner (placeholder)',
  version: '0.1.0',
  async analyze(req: AnalyzerRequest): Promise<AnalyzerResult> {
    const findings: RawFinding[] = [];
    for (const f of req.files) {
      if (/\.(js|mjs|cjs|ts|jsx|tsx|html)$/.test(f.path)) {
        findings.push(...scanFile(f.path, f.content));
      }
    }
    return { findings, analyzer: this.id, version: this.version };
  },
};
