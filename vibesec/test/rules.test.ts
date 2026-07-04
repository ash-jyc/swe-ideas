import { describe, expect, it } from 'vitest';
import { allRules } from '../src/core/rules/index.js';
import { scanContent } from '../src/core/scanner.js';

describe('rule engine', () => {
  it('has a meaningful rule set', () => {
    expect(allRules.length).toBeGreaterThanOrEqual(25);
  });

  it('has unique rule ids', () => {
    const ids = allRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every rule carries fix advice and test vectors', () => {
    for (const rule of allRules) {
      expect(rule.fix, rule.id).toBeTruthy();
      expect(rule.examples.vulnerable.length, `${rule.id} needs vulnerable examples`).toBeGreaterThan(0);
      expect(rule.examples.clean.length, `${rule.id} needs clean examples`).toBeGreaterThan(0);
    }
  });

  // Every rule must flag each of its vulnerable vectors and stay silent on
  // each clean vector — this is the false-positive/false-negative contract.
  for (const rule of allRules) {
    describe(rule.id, () => {
      for (const [i, example] of rule.examples.vulnerable.entries()) {
        it(`detects vulnerable example ${i + 1}`, () => {
          const findings = scanContent(example.file, example.code, [rule]);
          expect(
            findings.filter((f) => f.ruleId === rule.id),
            `${rule.id} should flag: ${example.code}`,
          ).not.toHaveLength(0);
        });
      }
      for (const [i, example] of rule.examples.clean.entries()) {
        it(`ignores clean example ${i + 1}`, () => {
          const findings = scanContent(example.file, example.code, [rule]);
          expect(
            findings.filter((f) => f.ruleId === rule.id),
            `${rule.id} should NOT flag: ${example.code}`,
          ).toHaveLength(0);
        });
      }
    });
  }

  it('applies language filters (SQL f-string rule ignores JS files)', () => {
    const pyOnly = allRules.find((r) => r.id === 'injection/sql-fstring')!;
    const code = 'cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")';
    expect(scanContent('app/db.py', code, [pyOnly])).toHaveLength(1);
    expect(scanContent('app/db.js', code, [pyOnly])).toHaveLength(0);
  });

  it('applies path filters (firestore rules only match .rules files)', () => {
    const rule = allRules.find((r) => r.id === 'baas/firestore-rules-open')!;
    const code = 'allow read, write: if true;';
    expect(scanContent('firestore.rules', code, [rule])).toHaveLength(1);
    expect(scanContent('notes.txt', code, [rule])).toHaveLength(0);
  });
});
