import type { Finding } from '../core/types.js';

interface PromptRequirement {
  match: (f: Finding) => boolean;
  line: string;
}

// Idea #63e from the original list: don't just fix the code — strengthen the
// prompts the vibe coder writes next time. Each requirement is phrased so it
// can be pasted straight into an AI coding assistant.
const REQUIREMENTS: PromptRequirement[] = [
  {
    match: (f) => f.ruleId?.startsWith('secrets/') === true || f.ruleId === 'project/committed-env-file',
    line: 'Never hardcode API keys, passwords, or tokens. Read all secrets from server-side environment variables, add .env to .gitignore, and generate a .env.example instead.',
  },
  {
    match: (f) => f.ruleId?.startsWith('baas/') === true,
    line: 'Enable Row Level Security (or Firebase security rules scoped to request.auth) on every table/collection, and verify access with the public anon key before shipping. Never use the service_role/admin key in client code.',
  },
  {
    match: (f) => f.ruleId?.startsWith('injection/sql') === true,
    line: 'Use parameterized queries for ALL database access — never build SQL by string concatenation, template literals, or f-strings.',
  },
  {
    match: (f) => f.ruleId === 'injection/js-command-exec' || f.ruleId === 'injection/py-shell' || f.ruleId === 'injection/eval' || f.ruleId === 'injection/new-function',
    line: 'Never pass user input to shell commands, eval, or dynamic code execution. Use argument-array process APIs (execFile/subprocess list form) and data-driven logic.',
  },
  {
    match: (f) => f.ruleId === 'injection/log-user-input',
    line: 'Log user-supplied values as structured fields, never interpolated into log strings.',
  },
  {
    match: (f) => f.cwe === 'CWE-79',
    line: 'Treat all user content as untrusted when rendering: use textContent/framework escaping by default and sanitize with DOMPurify anywhere raw HTML is unavoidable.',
  },
  {
    match: (f) => f.ruleId === 'web/cors-wildcard',
    line: 'Configure CORS with an explicit allowlist of my frontend origins — never "*".',
  },
  {
    match: (f) => f.ruleId?.startsWith('web/jwt') === true,
    line: 'Sign JWTs with a 32+ byte secret from an environment variable, pin one strong algorithm, and reject the "none" algorithm.',
  },
  {
    match: (f) => f.ruleId?.startsWith('crypto/') === true,
    line: 'Use bcrypt/argon2 for passwords and cryptographically secure randomness (crypto.randomBytes / secrets module) for every token, OTP, and session id.',
  },
  {
    match: (f) => f.ruleId?.startsWith('fs/') === true,
    line: 'Validate every user-influenced file path stays inside its base directory, and never deserialize untrusted data with pickle/yaml.load.',
  },
  {
    match: (f) => f.ruleId === 'project/webhook-no-signature-check',
    line: "Verify webhook signatures (provider SDK or HMAC with a timing-safe compare) before trusting any webhook payload.",
  },
  {
    match: (f) => f.ruleId === 'auditor/access-control',
    line: 'Enforce authorization on the SERVER for every endpoint: any route that reads or writes an object by id must verify the authenticated user owns it or has an explicit role grant. Hiding buttons in the UI is not authorization.',
  },
  {
    match: (f) => f.ruleId === 'auditor/auth',
    line: 'Implement auth flows (signup, login, password reset, sessions) with an established library — no hand-rolled token schemes — and require re-authentication for sensitive changes.',
  },
  {
    match: (f) => f.ruleId === 'auditor/rate-limiting',
    line: 'Add rate limiting to login, OTP, and other abusable or expensive endpoints.',
  },
  {
    match: (f) => f.ruleId === 'auditor/data-exposure',
    line: 'Return only the fields the client actually needs from each endpoint — never serialize whole database rows containing PII or credentials.',
  },
  {
    match: (f) => f.ruleId?.startsWith('deps/') === true,
    line: 'Use maintained dependencies with pinned versions and a lockfile; run npm audit / pip-audit before shipping.',
  },
];

/** Build prompt requirements the developer should add to their next AI coding prompt. */
export function hardenedPromptLines(findings: Finding[]): string[] {
  const lines: string[] = [];
  for (const requirement of REQUIREMENTS) {
    if (findings.some(requirement.match) && !lines.includes(requirement.line)) {
      lines.push(requirement.line);
    }
  }
  return lines;
}
