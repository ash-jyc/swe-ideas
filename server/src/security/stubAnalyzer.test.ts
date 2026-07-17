import { describe, it, expect } from 'vitest';
import { stubAnalyzer } from './stubAnalyzer.js';

describe('stubAnalyzer', () => {
  it('flags string-built SQL as CWE-89', async () => {
    const res = await stubAnalyzer.analyze({
      projectId: 'p',
      files: [
        {
          path: 'server.js',
          content: `db.prepare("SELECT * FROM notes WHERE body LIKE '%" + q + "%'").all()`,
        },
      ],
    });
    expect(res.findings.some((f) => f.cwe === 'CWE-89')).toBe(true);
  });

  it('flags exec with interpolation as CWE-78', async () => {
    const res = await stubAnalyzer.analyze({
      projectId: 'p',
      files: [{ path: 'server.js', content: "execSync('ping -c 1 ' + host)" }],
    });
    const cmd = res.findings.find((f) => f.cwe === 'CWE-78');
    expect(cmd).toBeTruthy();
    expect(cmd!.severity).toBe('critical');
  });

  it('reports file and line numbers', async () => {
    const res = await stubAnalyzer.analyze({
      projectId: 'p',
      files: [{ path: 'server.js', content: "line1\nexecSync('x ' + y)\nline3" }],
    });
    const f = res.findings[0]!;
    expect(f.file).toBe('server.js');
    expect(f.lineStart).toBe(2);
  });

  it('produces no findings for clean code', async () => {
    const res = await stubAnalyzer.analyze({
      projectId: 'p',
      files: [
        { path: 'server.js', content: 'db.prepare("SELECT * FROM notes WHERE id = ?").get(id)' },
      ],
    });
    expect(res.findings).toHaveLength(0);
  });
});
