import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Finding, Severity } from './types.js';

interface Advisory {
  name: string;
  severity: Severity;
  reason: string;
  alternative?: string;
}

// Offline advisory table: packages that are deprecated, abandoned, or have a
// history of compromise. Intentionally small and high-signal — a full CVE
// database is `npm audit` / `pip-audit`'s job, which need network access.
const NPM_ADVISORIES: Advisory[] = [
  { name: 'request', severity: 'medium', reason: 'Deprecated since 2020 and unmaintained; known vulnerabilities will never be fixed.', alternative: 'fetch (built-in) or undici' },
  { name: 'node-uuid', severity: 'medium', reason: 'Deprecated; early versions used insecure randomness for IDs.', alternative: 'uuid' },
  { name: 'md5', severity: 'high', reason: 'Wraps a broken hash; almost always ends up used on passwords or tokens.', alternative: 'bcrypt / node:crypto sha256' },
  { name: 'crypto-js', severity: 'medium', reason: 'Discontinued by its author in 2023; use the platform WebCrypto/node:crypto instead.', alternative: 'node:crypto / WebCrypto' },
  { name: 'event-stream', severity: 'high', reason: 'Was compromised in a 2018 supply-chain attack targeting wallets; unmaintained.', alternative: 'built-in streams' },
  { name: 'jsonwebtoken', severity: 'low', reason: 'Versions <9 accept insecure key types (CVE-2022-23529 family); ensure >=9 and pin algorithms.', alternative: 'jsonwebtoken@^9 or jose' },
];

const PYPI_ADVISORIES: Advisory[] = [
  { name: 'pycrypto', severity: 'high', reason: 'Abandoned since 2013 with known unpatched vulnerabilities (e.g. CVE-2013-7459).', alternative: 'pycryptodome or cryptography' },
  { name: 'python-jose', severity: 'medium', reason: 'Algorithm-confusion CVEs in 2024 (CVE-2024-33663/33664); largely unmaintained.', alternative: 'PyJWT or authlib' },
  { name: 'flask-security', severity: 'medium', reason: 'Original project is unmaintained; use the maintained fork.', alternative: 'flask-security-too' },
];

function depFinding(
  ruleId: string,
  severity: Severity,
  title: string,
  description: string,
  file: string,
  fix: string,
): Finding {
  return { id: '', source: 'deps', ruleId, severity, title, description, file, fix, status: 'unverified' };
}

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

/** Offline dependency review of package.json and requirements.txt. */
export async function auditDependencies(rootDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];

  const pkgRaw = await readIfExists(path.join(rootDir, 'package.json'));
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const [name, version] of Object.entries(deps)) {
        const advisory = NPM_ADVISORIES.find((a) => a.name === name);
        if (advisory) {
          findings.push(
            depFinding(
              'deps/known-risky-package',
              advisory.severity,
              `Risky npm dependency: ${name}`,
              `${advisory.reason}`,
              'package.json',
              advisory.alternative ? `Replace with ${advisory.alternative}.` : 'Replace with a maintained alternative.',
            ),
          );
        }
        if (version === '*' || version === 'latest') {
          findings.push(
            depFinding(
              'deps/wildcard-version',
              'medium',
              `Wildcard version for npm dependency: ${name}`,
              `"${name}": "${version}" installs whatever is newest at install time — a compromised release lands in your app automatically (supply-chain risk), and builds are not reproducible.`,
              'package.json',
              'Pin a semver range (e.g. ^1.2.3) and use a lockfile.',
            ),
          );
        }
      }
    } catch {
      // unparseable package.json — nothing to audit
    }
  }

  const reqRaw = await readIfExists(path.join(rootDir, 'requirements.txt'));
  if (reqRaw) {
    for (const rawLine of reqRaw.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('-')) continue;
      const name = line.split(/[<>=!~\[;\s]/)[0]!.toLowerCase();
      if (!name) continue;
      const advisory = PYPI_ADVISORIES.find((a) => a.name === name);
      if (advisory) {
        findings.push(
          depFinding(
            'deps/known-risky-package',
            advisory.severity,
            `Risky Python dependency: ${name}`,
            advisory.reason,
            'requirements.txt',
            advisory.alternative ? `Replace with ${advisory.alternative}.` : 'Replace with a maintained alternative.',
          ),
        );
      }
      if (!/[<>=~!]/.test(line)) {
        findings.push(
          depFinding(
            'deps/unpinned-python-dependency',
            'low',
            `Unpinned Python dependency: ${name}`,
            `"${line}" has no version constraint, so installs are not reproducible and a compromised new release is picked up automatically.`,
            'requirements.txt',
            'Pin versions (package==1.2.3) or use a lockfile-based tool (pip-tools, poetry, uv).',
          ),
        );
      }
    }
  }

  return findings;
}
