import type { Rule } from '../types.js';

const JS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
const PY = ['.py'];

export const cryptoRules: Rule[] = [
  {
    id: 'crypto/weak-hash',
    category: 'crypto',
    severity: 'high',
    cwe: 'CWE-327',
    title: 'MD5/SHA-1 used for hashing',
    description:
      'MD5 and SHA-1 are broken for security purposes. For passwords they are catastrophically fast to crack; for signatures they allow collisions.',
    fix: 'Use bcrypt/argon2 for passwords, SHA-256+ for integrity. (Non-security checksums are the only acceptable use.)',
    extensions: [...JS, ...PY],
    pattern: /createHash\s*\(\s*["'](?:md5|sha1)["']\s*\)|hashlib\.(?:md5|sha1)\s*\(/,
    negative: /etag|checksum|cache[_-]?key/i,
    examples: {
      vulnerable: [
        { code: "const hash = crypto.createHash('md5').update(password).digest('hex');", file: 'server/auth.js' },
        { code: 'digest = hashlib.sha1(password.encode()).hexdigest()', file: 'app/auth.py' },
      ],
      clean: [
        { code: 'const hash = await bcrypt.hash(password, 12);', file: 'server/auth.js' },
        { code: "const etag = crypto.createHash('md5').update(body).digest('hex'); // etag only", file: 'server/cache.js' },
      ],
    },
  },
  {
    id: 'crypto/math-random-secret',
    category: 'crypto',
    severity: 'high',
    cwe: 'CWE-338',
    title: 'Math.random() used for a security value',
    description:
      'Math.random() is predictable. Tokens, OTPs, session ids, or reset keys generated with it can be guessed by attackers.',
    fix: 'Use crypto.randomBytes / crypto.randomUUID / crypto.getRandomValues for anything security-relevant.',
    extensions: JS,
    pattern: /(?:token|secret|password|otp|nonce|session[_-]?id|reset[_-]?key|api[_-]?key|verification)\w*\s*=[^;\n]*Math\.random/i,
    examples: {
      vulnerable: [{ code: 'const resetToken = Math.random().toString(36).slice(2);', file: 'server/reset.js' }],
      clean: [
        { code: "const resetToken = crypto.randomBytes(32).toString('hex');", file: 'server/reset.js' },
        { code: 'const jitter = Math.random() * 100;', file: 'server/retry.js' },
      ],
    },
  },
  {
    id: 'crypto/py-random-secret',
    category: 'crypto',
    severity: 'high',
    cwe: 'CWE-338',
    title: 'random module used for a security value (Python)',
    description: 'The random module is not cryptographically secure; generated tokens/OTPs are predictable.',
    fix: 'Use the secrets module (secrets.token_urlsafe, secrets.choice) for security values.',
    extensions: PY,
    pattern: /(?:token|secret|password|otp|nonce|code)\w*\s*=[^#\n]*\brandom\.(?:random|randint|choice|choices|getrandbits|randrange)\b/i,
    negative: /secrets\.|SystemRandom/,
    examples: {
      vulnerable: [{ code: "otp_code = ''.join(random.choices('0123456789', k=6))", file: 'app/otp.py' }],
      clean: [
        { code: "otp_code = ''.join(secrets.choice('0123456789') for _ in range(6))", file: 'app/otp.py' },
        { code: 'sample = random.choice(quotes)', file: 'app/fun.py' },
      ],
    },
  },
];
