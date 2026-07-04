import type { Rule } from '../types.js';

const JS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
const PY = ['.py'];

export const injectionRules: Rule[] = [
  {
    id: 'injection/sql-template-literal',
    category: 'injection',
    severity: 'critical',
    cwe: 'CWE-89',
    title: 'SQL built with a template literal',
    description:
      'A SQL statement interpolates a variable with ${...}. If any interpolated value is user-influenced, this is SQL injection.',
    fix: 'Use parameterized queries: query("SELECT ... WHERE id = $1", [id]) — never interpolate values into SQL strings.',
    extensions: JS,
    pattern: /`\s*(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^`]*\$\{/i,
    examples: {
      vulnerable: [
        { code: 'const rows = await db.query(`SELECT * FROM users WHERE name = \'${req.query.name}\'`);', file: 'server/users.js' },
      ],
      clean: [
        { code: "const rows = await db.query('SELECT * FROM users WHERE name = $1', [req.query.name]);", file: 'server/users.js' },
      ],
    },
  },
  {
    id: 'injection/sql-string-concat',
    category: 'injection',
    severity: 'critical',
    cwe: 'CWE-89',
    title: 'SQL built by string concatenation',
    description: 'A SQL statement is concatenated with a variable using +. This is the classic SQL injection pattern.',
    fix: 'Use parameterized queries / prepared statements instead of concatenating values into SQL.',
    extensions: [...JS, ...PY],
    pattern: /["']\s*(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^"']*["']\s*\+\s*[A-Za-z_$]/i,
    examples: {
      vulnerable: [{ code: 'cursor.execute("SELECT * FROM users WHERE id = " + user_id)', file: 'app/db.py' }],
      clean: [{ code: 'cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))', file: 'app/db.py' }],
    },
  },
  {
    id: 'injection/sql-fstring',
    category: 'injection',
    severity: 'critical',
    cwe: 'CWE-89',
    title: 'SQL built with an f-string or .format()',
    description: 'A SQL statement interpolates variables via f-string, %, or .format(). User-influenced values make this SQL injection.',
    fix: 'Pass values as query parameters: cursor.execute("... WHERE id = %s", (user_id,)).',
    extensions: PY,
    pattern: /f"\s*(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^"]*\{|f'\s*(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^']*\{|["']\s*(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^"']*["']\s*(?:%\s*\(?[A-Za-z_]|\.format\()/i,
    examples: {
      vulnerable: [
        { code: 'cursor.execute(f"SELECT * FROM users WHERE email = \'{email}\'")', file: 'app/auth.py' },
        { code: 'cursor.execute("DELETE FROM posts WHERE id = {}".format(post_id))', file: 'app/posts.py' },
      ],
      clean: [{ code: 'cursor.execute("SELECT * FROM users WHERE email = %s", (email,))', file: 'app/auth.py' }],
    },
  },
  {
    id: 'injection/js-command-exec',
    category: 'injection',
    severity: 'critical',
    cwe: 'CWE-78',
    title: 'Shell command built from dynamic input',
    description:
      'child_process exec/execSync is called with an interpolated or concatenated string. User-influenced input becomes arbitrary command execution.',
    fix: 'Use execFile/spawn with an argument array (no shell), and validate/allowlist any user-provided values.',
    extensions: JS,
    pattern: /\bexec(?:Sync)?\s*\(\s*(?:`[^`]*\$\{|["'][^"']*["']\s*\+)/,
    examples: {
      vulnerable: [{ code: 'exec(`convert ${req.query.file} out.png`);', file: 'server/convert.js' }],
      clean: [{ code: "execFile('convert', [safePath, 'out.png']);", file: 'server/convert.js' }],
    },
  },
  {
    id: 'injection/py-shell',
    category: 'injection',
    severity: 'critical',
    cwe: 'CWE-78',
    title: 'Shell command built from dynamic input (Python)',
    description:
      'os.system/os.popen with an f-string, or subprocess with shell=True, executes attacker-influenced text as a shell command.',
    fix: 'Use subprocess.run([...]) with a list of arguments and shell=False (the default).',
    extensions: PY,
    pattern: /os\.system\s*\(\s*f["']|os\.popen\s*\(\s*f["']|subprocess\.(?:run|call|check_output|check_call|Popen)\s*\([^)]*shell\s*=\s*True/,
    examples: {
      vulnerable: [
        { code: 'os.system(f"ping {host}")', file: 'app/net.py' },
        { code: 'subprocess.run("ls " + path, shell=True)', file: 'app/files.py' },
      ],
      clean: [{ code: 'subprocess.run(["ping", "-c", "1", host])', file: 'app/net.py' }],
    },
  },
  {
    id: 'injection/eval',
    category: 'injection',
    severity: 'high',
    cwe: 'CWE-95',
    title: 'eval() on dynamic content',
    description: 'eval executes its argument as code. With any user-influenced input this is remote code execution.',
    fix: 'Replace eval with JSON.parse, a lookup table, or ast.literal_eval (Python) depending on intent.',
    extensions: [...JS, ...PY],
    pattern: /\beval\s*\(/,
    negative: /literal_eval|\.eval\s*\(\s*\)/,
    examples: {
      vulnerable: [{ code: 'const result = eval(req.body.expression);', file: 'server/calc.js' }],
      clean: [
        { code: 'const result = JSON.parse(req.body.expression);', file: 'server/calc.js' },
        { code: 'value = ast.literal_eval(raw)', file: 'app/parse.py' },
      ],
    },
  },
  {
    id: 'injection/new-function',
    category: 'injection',
    severity: 'high',
    cwe: 'CWE-95',
    title: 'new Function() constructor',
    description: 'new Function compiles a string into executable code — eval by another name.',
    fix: 'Avoid dynamic code generation; use data-driven logic instead.',
    extensions: JS,
    pattern: /new\s+Function\s*\(/,
    examples: {
      vulnerable: [{ code: 'const fn = new Function("x", userSnippet);', file: 'src/plugin.js' }],
      clean: [{ code: 'const fn = PLUGINS[userChoice];', file: 'src/plugin.js' }],
    },
  },
  {
    id: 'injection/log-user-input',
    category: 'injection',
    severity: 'medium',
    cwe: 'CWE-117',
    title: 'Unsanitized request data written to logs',
    description:
      'Request-derived values are interpolated directly into log lines. Attackers can forge log entries (CRLF injection) or poison log pipelines — the single most common flaw in AI-generated code (88% failure rate, Veracode 2025).',
    fix: 'Log structured fields (logger.info("login", { user }) ) or strip newlines from user input before logging.',
    extensions: [...JS, ...PY],
    pattern: /(?:console\.(?:log|info|warn|error)|logger?\.(?:info|warn|error|debug|log))\s*\([^)]*(?:`[^`]*\$\{\s*req\.|["'][^"']*["']\s*\+\s*req\.)|logg(?:er|ing)\.(?:info|warning|error|debug)\s*\(\s*f["'][^"']*\{\s*request\./,
    examples: {
      vulnerable: [
        { code: 'console.log(`login attempt for ${req.body.username}`);', file: 'server/auth.js' },
        { code: 'logging.info(f"login attempt for {request.form[\'username\']}")', file: 'app/auth.py' },
      ],
      clean: [{ code: "console.log('login attempt', { username: sanitize(req.body.username) });", file: 'server/auth.js' }],
    },
  },
];
