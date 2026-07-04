import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { scanProject, assignFindingIds } from '../src/core/scanner.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/vulnerable-app', import.meta.url));

describe('scanProject on the vulnerable fixture app', () => {
  it('finds every seeded pattern-detectable vulnerability', async () => {
    const { findings } = await scanProject(FIXTURE);
    const ruleIds = new Set(findings.map((f) => f.ruleId));

    // One per real-incident class seeded in the fixture.
    const expected = [
      'project/committed-env-file', // committed .env (Escape.tech class)
      'baas/firestore-rules-open', // Tea app class
      'baas/supabase-rls-disabled', // Moltbook class
      'secrets/hardcoded-supabase-service-key',
      'web/inner-html-dynamic',
      'web/dangerously-set-inner-html',
      'injection/sql-template-literal',
      'injection/js-command-exec',
      'project/webhook-no-signature-check',
      'crypto/weak-hash',
      'web/flask-debug',
      'injection/py-shell',
      'fs/pickle-load',
      'fs/yaml-unsafe-load',
      'secrets/hardcoded-password',
    ];
    for (const ruleId of expected) {
      expect(ruleIds, `expected ${ruleId} in ${[...ruleIds].join(', ')}`).toContain(ruleId);
    }
  });

  it('reports file and line for rule findings', async () => {
    const { findings } = await scanProject(FIXTURE);
    const sqlInjection = findings.find((f) => f.ruleId === 'injection/sql-template-literal');
    expect(sqlInjection?.file).toBe('server/routes/documents.js');
    expect(sqlInjection?.line).toBeGreaterThan(0);
    expect(sqlInjection?.snippet).toContain('SELECT * FROM documents');
  });

  it('does not flag the parameterized DELETE query', async () => {
    const { findings } = await scanProject(FIXTURE);
    const sqlFindings = findings.filter((f) => f.ruleId?.startsWith('injection/sql'));
    for (const f of sqlFindings) {
      expect(f.snippet).not.toContain('DELETE FROM documents');
    }
  });
});

describe('scanProject exclusions', () => {
  let dir: string;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('skips node_modules, minified files, and respects extra excludes', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'vibesec-scan-'));
    await mkdir(path.join(dir, 'node_modules', 'evil'), { recursive: true });
    await mkdir(path.join(dir, 'generated'), { recursive: true });
    const evil = 'const x = eval(userInput);\n';
    await writeFile(path.join(dir, 'node_modules', 'evil', 'index.js'), evil);
    await writeFile(path.join(dir, 'bundle.min.js'), evil);
    await writeFile(path.join(dir, 'generated', 'code.js'), evil);
    await writeFile(path.join(dir, 'app.js'), evil);

    const { findings } = await scanProject(dir, { excludeDirs: ['generated'] });
    const files = findings.map((f) => f.file);
    expect(files).toEqual(['app.js']);
  });

  it('skips files with very long (minified) lines', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'vibesec-scan-'));
    await writeFile(path.join(dir, 'blob.js'), 'const a = 1;' + 'x'.repeat(2000) + 'eval(z);\n');
    const { findings } = await scanProject(dir);
    expect(findings).toHaveLength(0);
  });
});

describe('assignFindingIds', () => {
  it('assigns sequential ids', async () => {
    const { findings } = await scanProject(FIXTURE);
    assignFindingIds(findings);
    expect(findings[0]!.id).toBe('F1');
    expect(new Set(findings.map((f) => f.id)).size).toBe(findings.length);
  });
});
