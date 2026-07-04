import type { Rule } from '../types.js';

// Example secrets are assembled at runtime so no provider-shaped token ever
// appears verbatim in this repository.
const AWS_EXAMPLE = 'AKIA' + 'IOSFODNN7EXAMPLE'; // AWS's documented example key id
const GH_EXAMPLE = 'ghp_' + 'a1B2'.repeat(9);
const STRIPE_EXAMPLE = 'sk_live_' + 'x9Y8z7W6v5U4t3S2r1Q0';
const ANTHROPIC_EXAMPLE = 'sk-ant-' + 'api03-' + 'fake0'.repeat(6);
const OPENAI_EXAMPLE = 'sk-' + 'proj-' + 'Fak3'.repeat(10);
const SLACK_EXAMPLE = 'xoxb-' + '1234567890-abcdefFAKE';
const GOOGLE_EXAMPLE = 'AIza' + 'SyFakeFakeFakeFakeFakeFakeFakeFake0';
const FAKE_JWT = 'eyJ' + 'hbGciOiJIUzI1NiJ9.fakepayload.fakesig';
const PEM_HEADER = ['-----BEGIN RSA', 'PRIVATE KEY-----'].join(' ');

export const secretRules: Rule[] = [
  {
    id: 'secrets/aws-access-key-id',
    category: 'secrets',
    severity: 'critical',
    cwe: 'CWE-798',
    title: 'AWS access key ID committed to source',
    description:
      'A string matching the AWS access key ID format (AKIA...) appears in source. Paired with its secret key it grants direct access to your AWS account.',
    fix: 'Revoke the key in IAM immediately, then load credentials from environment variables or an IAM role instead of source code.',
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
    examples: {
      vulnerable: [{ code: `const s3Key = "${AWS_EXAMPLE}";`, file: 'src/upload.js' }],
      clean: [{ code: 'const s3Key = process.env.AWS_ACCESS_KEY_ID;', file: 'src/upload.js' }],
    },
  },
  {
    id: 'secrets/github-token',
    category: 'secrets',
    severity: 'critical',
    cwe: 'CWE-798',
    title: 'GitHub token committed to source',
    description: 'A GitHub personal access / OAuth / app token (ghp_/gho_/ghu_/ghs_/ghr_) appears in source.',
    fix: 'Revoke the token in GitHub settings and load it from an environment variable or secret manager.',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
    examples: {
      vulnerable: [{ code: `TOKEN = "${GH_EXAMPLE}"`, file: 'scripts/release.py' }],
      clean: [{ code: 'TOKEN = os.environ["GITHUB_TOKEN"]', file: 'scripts/release.py' }],
    },
  },
  {
    id: 'secrets/stripe-live-key',
    category: 'secrets',
    severity: 'critical',
    cwe: 'CWE-798',
    title: 'Stripe live secret key committed to source',
    description: 'A Stripe live-mode secret/restricted key (sk_live_/rk_live_) appears in source. It can charge cards and read customer data.',
    fix: 'Roll the key in the Stripe dashboard and keep it server-side in an environment variable.',
    pattern: /\b[rs]k_live_[A-Za-z0-9]{16,}\b/,
    examples: {
      vulnerable: [{ code: `const stripe = require('stripe')('${STRIPE_EXAMPLE}');`, file: 'server/billing.js' }],
      clean: [{ code: "const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);", file: 'server/billing.js' }],
    },
  },
  {
    id: 'secrets/anthropic-api-key',
    category: 'secrets',
    severity: 'critical',
    cwe: 'CWE-798',
    title: 'Anthropic API key committed to source',
    description: 'An Anthropic API key (sk-ant-...) appears in source.',
    fix: 'Revoke the key in the Anthropic console and load it from an environment variable.',
    pattern: /\bsk-ant-[A-Za-z0-9_-]{24,}\b/,
    examples: {
      vulnerable: [{ code: `ANTHROPIC_API_KEY = "${ANTHROPIC_EXAMPLE}"`, file: 'bot/config.py' }],
      clean: [{ code: 'ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")', file: 'bot/config.py' }],
    },
  },
  {
    id: 'secrets/openai-api-key',
    category: 'secrets',
    severity: 'critical',
    cwe: 'CWE-798',
    title: 'OpenAI API key committed to source',
    description: 'An OpenAI API key (sk-...) appears in source.',
    fix: 'Revoke the key and load it from an environment variable.',
    pattern: /\bsk-(?!ant-)[A-Za-z0-9_-]{36,}\b/,
    examples: {
      vulnerable: [{ code: `const openai = new OpenAI({ apiKey: "${OPENAI_EXAMPLE}" });`, file: 'src/ai.ts' }],
      clean: [{ code: 'const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });', file: 'src/ai.ts' }],
    },
  },
  {
    id: 'secrets/slack-token',
    category: 'secrets',
    severity: 'high',
    cwe: 'CWE-798',
    title: 'Slack token committed to source',
    description: 'A Slack bot/user/app token (xox...) appears in source.',
    fix: 'Revoke the token in the Slack app settings and load it from an environment variable.',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
    examples: {
      vulnerable: [{ code: `slack_token = "${SLACK_EXAMPLE}"`, file: 'notify.py' }],
      clean: [{ code: 'slack_token = os.environ.get("SLACK_TOKEN")', file: 'notify.py' }],
    },
  },
  {
    id: 'secrets/google-api-key',
    category: 'secrets',
    severity: 'high',
    cwe: 'CWE-798',
    title: 'Google API key committed to source',
    description:
      'A Google API key (AIza...) appears in source. Even "browser" keys must be restricted by referrer/API, and server keys must never be committed.',
    fix: 'Restrict or regenerate the key in Google Cloud console; keep unrestricted keys in environment variables.',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,
    examples: {
      vulnerable: [{ code: `const mapsKey = "${GOOGLE_EXAMPLE}";`, file: 'src/map.js' }],
      clean: [{ code: 'const mapsKey = import.meta.env.VITE_MAPS_KEY;', file: 'src/map.js' }],
    },
  },
  {
    id: 'secrets/private-key-block',
    category: 'secrets',
    severity: 'critical',
    cwe: 'CWE-798',
    title: 'Private key material committed to source',
    description: 'A PEM private key block appears in the repository.',
    fix: 'Remove the key from the repo and history, rotate it, and store keys in a secret manager.',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/,
    examples: {
      vulnerable: [{ code: PEM_HEADER, file: 'deploy/id_rsa.pem' }],
      clean: [{ code: '-----BEGIN PUBLIC KEY-----', file: 'deploy/id_rsa.pub' }],
    },
  },
  {
    id: 'secrets/hardcoded-password',
    category: 'secrets',
    severity: 'medium',
    cwe: 'CWE-259',
    title: 'Hardcoded password',
    description: 'A password appears to be assigned from a string literal.',
    fix: 'Load passwords from environment variables or a secret manager; never commit them.',
    pattern: /(?:password|passwd|pwd)["']?\s*[:=]\s*["'][^"']{4,}["']/i,
    negative: /(?:process\.env|os\.environ|getenv|import\.meta\.env|\$\{|%s|\{\}|example|placeholder|changeme|your[_-]?pass|dummy|xxxx)/i,
    examples: {
      vulnerable: [{ code: 'DB_PASSWORD = "hunter2secret"', file: 'app/db.py' }],
      clean: [
        { code: 'DB_PASSWORD = os.environ["DB_PASSWORD"]', file: 'app/db.py' },
        { code: 'password: "changeme-example"', file: 'docs/config.sample.yml' },
      ],
    },
  },
  {
    id: 'secrets/generic-api-key',
    category: 'secrets',
    severity: 'high',
    cwe: 'CWE-798',
    title: 'Hardcoded API key / secret / token',
    description: 'An API key, secret, or token appears to be assigned from a long string literal.',
    fix: 'Move the value to an environment variable or secret manager and rotate it.',
    pattern: /(?:api[_-]?key|api[_-]?secret|access[_-]?token|auth[_-]?token|client[_-]?secret|signing[_-]?secret)["']?\s*[:=]\s*["'][A-Za-z0-9_\-/+=.]{16,}["']/i,
    negative: /(?:process\.env|os\.environ|getenv|import\.meta\.env|\$\{|YOUR_|<[^>]*>|example|placeholder|xxxx|dummy)/i,
    examples: {
      vulnerable: [{ code: 'const config = { apiKey: "9f8e7d6c5b4a39281706fivefake" };', file: 'src/config.ts' }],
      clean: [
        { code: 'const config = { apiKey: process.env.API_KEY };', file: 'src/config.ts' },
        { code: 'api_key = "YOUR_API_KEY_GOES_HERE_1234"', file: 'README.md' },
      ],
    },
  },
  {
    id: 'secrets/public-env-secret',
    category: 'secrets',
    severity: 'high',
    cwe: 'CWE-200',
    title: 'Secret exposed through a public/client env var prefix',
    description:
      'Env vars prefixed NEXT_PUBLIC_/VITE_/REACT_APP_/EXPO_PUBLIC_ are bundled into the browser build. Naming one *SECRET*, *SERVICE_ROLE*, *PRIVATE*, *PASSWORD*, or *TOKEN* ships that value to every visitor.',
    fix: 'Move the value to a server-only env var and access it from an API route or backend, never from client code.',
    incident:
      'Escape.tech found 400+ exposed secrets across 5,600 vibe-coded apps, many via service keys in frontend bundles.',
    pattern: /\b(?:NEXT_PUBLIC|VITE|REACT_APP|EXPO_PUBLIC|NUXT_PUBLIC)_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN)[A-Z0-9_]*\b/,
    examples: {
      vulnerable: [{ code: 'const key = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;', file: 'src/pages/index.tsx' }],
      clean: [{ code: 'const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;', file: 'src/pages/index.tsx' }],
    },
  },
  {
    id: 'secrets/hardcoded-supabase-service-key',
    category: 'secrets',
    severity: 'critical',
    cwe: 'CWE-798',
    title: 'Supabase service_role key hardcoded',
    description:
      'A service_role key is assigned from a literal JWT. The service_role key bypasses Row Level Security entirely; anywhere it leaks, your whole database is readable and writable.',
    fix: 'Rotate the key in Supabase, load it from a server-only env var, and never reference service_role in client code.',
    incident:
      'Moltbook (Jan 2026): a leaked Supabase key with RLS disabled exposed 1.5M API keys and 35K emails.',
    pattern: /SERVICE_ROLE[A-Z_]*["']?\s*[:=]\s*["'`]eyJ[A-Za-z0-9_-]{8,}/,
    examples: {
      vulnerable: [{ code: `const SUPABASE_SERVICE_ROLE_KEY = "${FAKE_JWT}";`, file: 'src/lib/supabase.js' }],
      clean: [{ code: 'const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;', file: 'server/supabase.js' }],
    },
  },
];
