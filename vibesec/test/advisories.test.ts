import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { auditDependencies } from '../src/core/advisories.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/vulnerable-app', import.meta.url));

describe('auditDependencies', () => {
  let dir: string;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('flags known-risky and wildcard npm dependencies in the fixture', async () => {
    const findings = await auditDependencies(FIXTURE);
    expect(findings.some((f) => f.ruleId === 'deps/known-risky-package' && f.title.includes('request'))).toBe(true);
    expect(findings.some((f) => f.ruleId === 'deps/wildcard-version' && f.title.includes('lodash'))).toBe(true);
    expect(findings.some((f) => f.title.includes('express'))).toBe(false);
  });

  it('flags risky and unpinned Python dependencies', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'vibesec-deps-'));
    await writeFile(path.join(dir, 'requirements.txt'), '# deps\nflask\npycrypto==2.6.1\nrequests>=2.31\n');
    const findings = await auditDependencies(dir);
    expect(findings.some((f) => f.ruleId === 'deps/known-risky-package' && f.title.includes('pycrypto'))).toBe(true);
    expect(findings.some((f) => f.ruleId === 'deps/unpinned-python-dependency' && f.title.includes('flask'))).toBe(true);
    expect(findings.some((f) => f.ruleId === 'deps/unpinned-python-dependency' && f.title.includes('requests'))).toBe(false);
  });

  it('returns nothing for a project without manifests', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'vibesec-deps-'));
    expect(await auditDependencies(dir)).toHaveLength(0);
  });
});
