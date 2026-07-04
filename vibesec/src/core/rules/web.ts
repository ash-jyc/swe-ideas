import type { Rule } from '../types.js';

const JS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
const PY = ['.py'];

export const webRules: Rule[] = [
  {
    id: 'web/inner-html-dynamic',
    category: 'web',
    severity: 'high',
    cwe: 'CWE-79',
    title: 'innerHTML assigned dynamic content',
    description:
      'Assigning non-static content to innerHTML/outerHTML renders it as HTML. User-influenced values become stored/reflected XSS — AI models fail XSS tasks 86% of the time (Veracode 2025).',
    fix: 'Use textContent for text, or sanitize with DOMPurify before inserting HTML.',
    extensions: JS,
    pattern: /\.(?:inner|outer)HTML\s*=(?!=)/,
    negative: /\.(?:inner|outer)HTML\s*=\s*["'`][^$+]*["'`]\s*;?\s*$|DOMPurify|sanitize/i,
    examples: {
      vulnerable: [{ code: 'card.innerHTML = `<h2>${profile.bio}</h2>`;', file: 'src/profile.js' }],
      clean: [
        { code: "card.innerHTML = '<div class=\"spinner\"></div>';", file: 'src/profile.js' },
        { code: 'card.innerHTML = DOMPurify.sanitize(profile.bio);', file: 'src/profile.js' },
      ],
    },
  },
  {
    id: 'web/document-write',
    category: 'web',
    severity: 'medium',
    cwe: 'CWE-79',
    title: 'document.write usage',
    description: 'document.write renders strings as HTML and is a common XSS sink.',
    fix: 'Build DOM nodes with createElement/textContent, or sanitize any HTML you must inject.',
    extensions: JS,
    pattern: /document\.write(?:ln)?\s*\(/,
    examples: {
      vulnerable: [{ code: 'document.write("<p>" + location.hash + "</p>");', file: 'src/legacy.js' }],
      clean: [{ code: "container.textContent = location.hash;", file: 'src/legacy.js' }],
    },
  },
  {
    id: 'web/dangerously-set-inner-html',
    category: 'web',
    severity: 'high',
    cwe: 'CWE-79',
    title: 'dangerouslySetInnerHTML without sanitization',
    description: 'React renders this HTML verbatim; user-influenced content becomes XSS.',
    fix: 'Render as text, or sanitize with DOMPurify: dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}.',
    extensions: JS,
    pattern: /dangerouslySetInnerHTML/,
    negative: /DOMPurify|sanitize/i,
    examples: {
      vulnerable: [{ code: '<div dangerouslySetInnerHTML={{ __html: comment.body }} />', file: 'src/Comment.tsx' }],
      clean: [
        { code: '<div>{comment.body}</div>', file: 'src/Comment.tsx' },
        { code: '<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.body) }} />', file: 'src/Comment.tsx' },
      ],
    },
  },
  {
    id: 'web/cors-wildcard',
    category: 'web',
    severity: 'medium',
    cwe: 'CWE-942',
    title: 'CORS configured with a wildcard origin',
    description:
      'Allowing origin "*" lets any website call this API from a visitor\'s browser. Combined with credentials or ambient auth this leaks data cross-origin.',
    fix: 'Allowlist the exact origins your frontend uses.',
    pattern: /Access-Control-Allow-Origin["']?\s*[,:]\s*["']\*["']|\borigin\s*:\s*["']\*["']/,
    examples: {
      vulnerable: [{ code: "app.use(cors({ origin: '*', credentials: true }));", file: 'server/index.js' }],
      clean: [{ code: "app.use(cors({ origin: ['https://app.example.com'] }));", file: 'server/index.js' }],
    },
  },
  {
    id: 'web/flask-debug',
    category: 'web',
    severity: 'high',
    cwe: 'CWE-489',
    title: 'Flask app running with debug=True',
    description:
      'Debug mode exposes the Werkzeug interactive debugger — anyone reaching the app gets a Python shell on your server.',
    fix: 'Set debug via environment (FLASK_DEBUG) and never enable it in production.',
    extensions: PY,
    pattern: /\.run\s*\([^)]*debug\s*=\s*True/,
    examples: {
      vulnerable: [{ code: 'app.run(host="0.0.0.0", debug=True)', file: 'app/main.py' }],
      clean: [{ code: 'app.run(host="0.0.0.0", debug=os.getenv("FLASK_DEBUG") == "1")', file: 'app/main.py' }],
    },
  },
  {
    id: 'web/insecure-cookie-flags',
    category: 'web',
    severity: 'medium',
    cwe: 'CWE-614',
    title: 'Cookie security flag explicitly disabled',
    description: 'secure/httpOnly set to false lets cookies travel over plain HTTP or be read by injected scripts.',
    fix: 'Set secure: true, httpOnly: true, and an appropriate sameSite value on session cookies.',
    extensions: [...JS, ...PY],
    pattern: /(?:secure|httpOnly)\s*:\s*false|(?:secure|httponly)\s*=\s*False/,
    examples: {
      vulnerable: [{ code: "res.cookie('session', token, { httpOnly: false, secure: false });", file: 'server/auth.js' }],
      clean: [{ code: "res.cookie('session', token, { httpOnly: true, secure: true, sameSite: 'lax' });", file: 'server/auth.js' }],
    },
  },
  {
    id: 'web/jwt-none-algorithm',
    category: 'web',
    severity: 'critical',
    cwe: 'CWE-347',
    title: 'JWT "none" algorithm accepted',
    description: 'Accepting alg "none" means unsigned tokens verify successfully — anyone can forge any identity.',
    fix: 'Pin a single strong algorithm (e.g. algorithms: ["HS256"]) and reject everything else.',
    pattern: /alg(?:orithms?)?["']?\s*[:=]\s*\[?\s*["']none["']/i,
    examples: {
      vulnerable: [{ code: "jwt.verify(token, key, { algorithms: ['none'] });", file: 'server/jwt.js' }],
      clean: [{ code: "jwt.verify(token, key, { algorithms: ['HS256'] });", file: 'server/jwt.js' }],
    },
  },
  {
    id: 'web/jwt-weak-secret',
    category: 'web',
    severity: 'high',
    cwe: 'CWE-521',
    title: 'JWT signed/verified with a short literal secret',
    description: 'A short hardcoded signing secret can be brute-forced offline, letting attackers mint valid tokens.',
    fix: 'Use a long random secret from an environment variable (32+ bytes), or asymmetric keys.',
    extensions: [...JS, ...PY],
    pattern: /jwt\.(?:sign|verify|encode|decode)\s*\([^)]*,\s*["'][^"']{1,12}["']/,
    examples: {
      vulnerable: [{ code: "const token = jwt.sign(payload, 'secret123');", file: 'server/auth.js' }],
      clean: [{ code: 'const token = jwt.sign(payload, process.env.JWT_SECRET);', file: 'server/auth.js' }],
    },
  },
];
