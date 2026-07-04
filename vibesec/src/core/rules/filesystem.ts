import type { Rule } from '../types.js';

const JS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
const PY = ['.py'];

export const filesystemRules: Rule[] = [
  {
    id: 'fs/path-traversal-js',
    category: 'filesystem',
    severity: 'high',
    cwe: 'CWE-22',
    title: 'Request data used directly in a filesystem path',
    description:
      'req.params/query/body flows into a filesystem call. "../" sequences let attackers read or write files outside the intended directory.',
    fix: 'Resolve against a base dir and verify the result stays inside it: const p = path.resolve(base, name); if (!p.startsWith(base + path.sep)) reject.',
    extensions: JS,
    pattern: /(?:fs\w*\.\w+|path\.join|res\.sendFile|createReadStream|createWriteStream)\s*\([^)]*req\.(?:params|query|body)/,
    examples: {
      vulnerable: [{ code: "res.sendFile(path.join(UPLOADS, req.params.filename));", file: 'server/files.js' }],
      clean: [{ code: 'res.sendFile(path.join(UPLOADS, safeName));', file: 'server/files.js' }],
    },
  },
  {
    id: 'fs/path-traversal-py',
    category: 'filesystem',
    severity: 'high',
    cwe: 'CWE-22',
    title: 'Request data used directly in a filesystem path (Python)',
    description: 'request.args/form/json flows into open()/os.path.join()/send_file(), enabling directory traversal.',
    fix: 'Use werkzeug.utils.secure_filename / os.path.realpath and verify the path stays inside the allowed directory.',
    extensions: PY,
    pattern: /(?:\bopen|os\.path\.join|send_file|send_from_directory)\s*\([^)]*request\.(?:args|form|values|json|GET|POST)/,
    examples: {
      vulnerable: [{ code: "return send_file(os.path.join(UPLOADS, request.args['name']))", file: 'app/files.py' }],
      clean: [{ code: "return send_from_directory(UPLOADS, secure_filename(name))", file: 'app/files.py' }],
    },
  },
  {
    id: 'fs/pickle-load',
    category: 'filesystem',
    severity: 'high',
    cwe: 'CWE-502',
    title: 'pickle deserialization',
    description:
      'pickle.load(s) executes arbitrary code embedded in the payload. Unpickling anything user-supplied is remote code execution.',
    fix: 'Use JSON (or another data-only format) for untrusted input; reserve pickle for data you generated yourself.',
    extensions: PY,
    pattern: /pickle\.loads?\s*\(/,
    examples: {
      vulnerable: [{ code: 'session = pickle.loads(request.cookies["state"])', file: 'app/session.py' }],
      clean: [{ code: 'session = json.loads(request.cookies["state"])', file: 'app/session.py' }],
    },
  },
  {
    id: 'fs/yaml-unsafe-load',
    category: 'filesystem',
    severity: 'high',
    cwe: 'CWE-502',
    title: 'yaml.load without SafeLoader',
    description: 'yaml.load with the default/full loader can instantiate arbitrary Python objects from the document.',
    fix: 'Use yaml.safe_load, or pass Loader=yaml.SafeLoader.',
    extensions: PY,
    pattern: /yaml\.load\s*\(/,
    negative: /SafeLoader|safe_load/,
    examples: {
      vulnerable: [{ code: 'config = yaml.load(f)', file: 'app/config.py' }],
      clean: [
        { code: 'config = yaml.safe_load(f)', file: 'app/config.py' },
        { code: 'config = yaml.load(f, Loader=yaml.SafeLoader)', file: 'app/config.py' },
      ],
    },
  },
  {
    id: 'fs/tar-extractall',
    category: 'filesystem',
    severity: 'medium',
    cwe: 'CWE-22',
    title: 'Archive extractall without member validation',
    description:
      'extractall on an untrusted archive follows entries like "../../etc/cron.d/x" (zip-slip), writing files anywhere on disk.',
    fix: 'Pass filter="data" (Python 3.12+) or validate each member path before extraction.',
    extensions: PY,
    pattern: /\.extractall\s*\(/,
    negative: /filter\s*=|members\s*=/,
    examples: {
      vulnerable: [{ code: 'tar.extractall(dest)', file: 'app/import.py' }],
      clean: [{ code: 'tar.extractall(dest, filter="data")', file: 'app/import.py' }],
    },
  },
];
