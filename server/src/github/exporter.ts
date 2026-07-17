import { availableDeps } from '../codegen/systemPrompt.js';

// Push a generated project to a new GitHub repo using the Git Data API
// (blobs → tree → commit → ref) so the whole project lands in a single commit.
// The user's PAT is used only for this request and is never persisted.

const API = 'https://api.github.com';

interface File {
  path: string;
  content: string;
}

async function gh(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'vibe-secure-platform',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = json?.message || `GitHub API ${res.status}`;
    throw new Error(`${msg}${json?.errors ? ': ' + JSON.stringify(json.errors) : ''}`);
  }
  return json;
}

/** Add a runnable package.json + README if the project doesn't supply them. */
function withScaffold(files: File[], repoName: string, description?: string): File[] {
  const out = [...files];
  if (!out.some((f) => f.path === 'package.json')) {
    const server = out.find((f) => f.path === 'server.js');
    const isEsm =
      !server ||
      /\bimport\s.+\sfrom\s/.test(server.content) ||
      /\bexport\s/.test(server.content);
    out.push({
      path: 'package.json',
      content:
        JSON.stringify(
          {
            name: repoName,
            version: '0.1.0',
            private: true,
            type: isEsm ? 'module' : 'commonjs',
            scripts: { start: 'node server.js' },
            dependencies: availableDeps(),
          },
          null,
          2,
        ) + '\n',
    });
  }
  if (!out.some((f) => f.path.toLowerCase() === 'readme.md')) {
    out.push({
      path: 'README.md',
      content: `# ${repoName}\n\n${description ?? 'Generated with the Secure Vibe Coding Platform.'}\n\n## Run locally\n\n\`\`\`bash\nnpm install\nnode server.js\n\`\`\`\n\nThe server listens on \`process.env.PORT\` (default 3000).\n`,
    });
  }
  if (!out.some((f) => f.path === '.gitignore')) {
    out.push({ path: '.gitignore', content: 'node_modules/\ndata.sqlite*\n' });
  }
  return out;
}

export async function exportToGithub(
  token: string,
  repoName: string,
  files: File[],
  options: { private?: boolean; description?: string } = {},
): Promise<{ repoUrl: string; commitSha: string }> {
  if (files.length === 0) throw new Error('Project has no files to export');

  const repo = await gh(token, 'POST', '/user/repos', {
    name: repoName,
    private: options.private ?? true,
    description: options.description,
    auto_init: false,
  });
  const owner: string = repo.owner.login;
  const name: string = repo.name;

  const scaffolded = withScaffold(files, name, options.description);

  const tree = [];
  for (const f of scaffolded) {
    const blob = await gh(token, 'POST', `/repos/${owner}/${name}/git/blobs`, {
      content: Buffer.from(f.content, 'utf8').toString('base64'),
      encoding: 'base64',
    });
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const createdTree = await gh(token, 'POST', `/repos/${owner}/${name}/git/trees`, {
    tree,
  });
  const commit = await gh(token, 'POST', `/repos/${owner}/${name}/git/commits`, {
    message: 'Initial commit from Secure Vibe Coding Platform',
    tree: createdTree.sha,
    parents: [],
  });
  await gh(token, 'POST', `/repos/${owner}/${name}/git/refs`, {
    ref: 'refs/heads/main',
    sha: commit.sha,
  });

  return { repoUrl: repo.html_url, commitSha: commit.sha };
}
