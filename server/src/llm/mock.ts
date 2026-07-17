import type { LlmAdapter, LlmChunk, LlmRequest } from './types.js';

// Deterministic, network-free adapter used for local development, automated
// tests, and the e2e smoke run. It emits valid <vibefile> blocks streamed
// token-by-token so the whole pipeline (SSE → parse → apply → diff → run) can
// be exercised without spending API credits.

const TODO_APP = String.raw`Here's a simple full-stack todo app with an Express backend and a SQLite database.

<vibefile path="server.js">
import express from 'express';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(process.env.DATA_FILE || './data.sqlite');
db.exec('CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY, title TEXT, done INTEGER DEFAULT 0)');

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

app.get('/api/todos', (req, res) => {
  res.json(db.prepare('SELECT * FROM todos ORDER BY id DESC').all());
});

app.post('/api/todos', (req, res) => {
  const info = db.prepare('INSERT INTO todos (title) VALUES (?)').run(req.body.title || '');
  res.json({ id: info.lastInsertRowid });
});

app.post('/api/todos/:id/toggle', (req, res) => {
  db.prepare('UPDATE todos SET done = 1 - done WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.delete('/api/todos/:id', (req, res) => {
  db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('todo app listening on ' + port));
</vibefile>

<vibefile path="public/index.html">
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <base href="./" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Todo</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main>
    <h1>My Todos</h1>
    <form id="add"><input id="title" placeholder="What needs doing?" autocomplete="off" /><button>Add</button></form>
    <ul id="list"></ul>
  </main>
  <script src="app.js"></script>
</body>
</html>
</vibefile>

<vibefile path="public/style.css">
* { box-sizing: border-box; }
body { font-family: system-ui, sans-serif; background: #0f1117; color: #e6e8ef; margin: 0; }
main { max-width: 520px; margin: 6vh auto; padding: 0 20px; }
h1 { font-weight: 650; }
form { display: flex; gap: 8px; }
input { flex: 1; padding: 10px 12px; border-radius: 8px; border: 1px solid #2a2f3a; background: #171a22; color: inherit; }
button { padding: 10px 16px; border-radius: 8px; border: 0; background: #6d7cff; color: white; cursor: pointer; }
ul { list-style: none; padding: 0; margin-top: 20px; }
li { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; background: #171a22; margin-bottom: 8px; }
li.done span { text-decoration: line-through; opacity: 0.5; }
li span { flex: 1; }
li button { background: transparent; color: #8b93a7; padding: 4px 8px; }
</vibefile>

<vibefile path="public/app.js">
const list = document.getElementById('list');
async function load() {
  const todos = await (await fetch('api/todos')).json();
  list.innerHTML = '';
  for (const t of todos) {
    const li = document.createElement('li');
    if (t.done) li.className = 'done';
    const span = document.createElement('span');
    span.textContent = t.title;
    const toggle = document.createElement('button');
    toggle.textContent = t.done ? 'undo' : 'done';
    toggle.onclick = async () => { await fetch('api/todos/' + t.id + '/toggle', { method: 'POST' }); load(); };
    const del = document.createElement('button');
    del.textContent = 'x';
    del.onclick = async () => { await fetch('api/todos/' + t.id, { method: 'DELETE' }); load(); };
    li.append(span, toggle, del);
    list.appendChild(li);
  }
}
document.getElementById('add').onsubmit = async (e) => {
  e.preventDefault();
  const title = document.getElementById('title');
  if (!title.value.trim()) return;
  await fetch('api/todos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: title.value }) });
  title.value = '';
  load();
};
load();
</vibefile>

The app stores todos in SQLite and serves a small UI from ./public. Click Run to preview it.`;

const VULN_APP = String.raw`Here's a notes app with search and a simple admin ping tool.

<vibefile path="server.js">
import express from 'express';
import Database from 'better-sqlite3';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(process.env.DATA_FILE || './data.sqlite');
db.exec('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, body TEXT)');

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

app.get('/api/notes', (req, res) => {
  const q = req.query.q || '';
  const rows = db.prepare("SELECT * FROM notes WHERE body LIKE '%" + q + "%'").all();
  res.json(rows);
});

app.post('/api/notes', (req, res) => {
  db.prepare('INSERT INTO notes (body) VALUES (?)').run(req.body.body || '');
  res.send('<p>Saved note: ' + req.body.body + '</p>');
});

app.get('/api/ping', (req, res) => {
  const host = req.query.host || 'localhost';
  const out = execSync('ping -c 1 ' + host).toString();
  res.type('text').send(out);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('notes app on ' + port));
</vibefile>

<vibefile path="public/index.html">
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <base href="./" />
  <title>Notes</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main>
    <h1>Notes</h1>
    <form id="add"><input id="body" placeholder="New note" /><button>Save</button></form>
    <input id="q" placeholder="Search notes" />
    <div id="results"></div>
  </main>
  <script src="app.js"></script>
</body>
</html>
</vibefile>

<vibefile path="public/style.css">
body { font-family: system-ui, sans-serif; background: #0f1117; color: #e6e8ef; }
main { max-width: 560px; margin: 6vh auto; }
input { padding: 10px; border-radius: 8px; border: 1px solid #2a2f3a; background: #171a22; color: inherit; }
button { padding: 10px 16px; border-radius: 8px; border: 0; background: #6d7cff; color: white; }
#results div { padding: 8px; background: #171a22; border-radius: 8px; margin-top: 8px; }
</vibefile>

<vibefile path="public/app.js">
const results = document.getElementById('results');
async function search() {
  const q = document.getElementById('q').value;
  const rows = await (await fetch('api/notes?q=' + encodeURIComponent(q))).json();
  results.innerHTML = rows.map(r => '<div>' + r.body + '</div>').join('');
}
document.getElementById('q').oninput = search;
document.getElementById('add').onsubmit = async (e) => {
  e.preventDefault();
  const body = document.getElementById('body').value;
  await fetch('api/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body }) });
  document.getElementById('body').value = '';
  search();
};
search();
</vibefile>

The app stores notes in SQLite, supports search, and has a small admin ping utility.`;

const INCREMENT = String.raw`I tweaked the styling to add a subtle card shadow and a footer.

<vibefile path="public/footer-note.txt">
Updated by the mock provider on turn increment.
</vibefile>

That's a small additive change so you can see the diff and history.`;

function scriptFor(req: LlmRequest): string {
  const userMessages = req.messages.filter((m) => m.role === 'user');
  const isFirstTurn = userMessages.length <= 1;
  if (!isFirstTurn) return INCREMENT;
  if (req.model === 'mock-vulnerable') return VULN_APP;
  return TODO_APP;
}

function* chunkString(s: string, size: number): Generator<string> {
  for (let i = 0; i < s.length; i += size) yield s.slice(i, i + size);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockAdapter: LlmAdapter = {
  id: 'mock',
  async *stream(req: LlmRequest): AsyncGenerator<LlmChunk> {
    const script = scriptFor(req);
    for (const chunk of chunkString(script, 24)) {
      if (req.signal?.aborted) return;
      yield { type: 'text', text: chunk };
      await delay(6);
    }
    yield {
      type: 'usage',
      usage: {
        promptTokens: 512,
        completionTokens: Math.ceil(script.length / 4),
        totalTokens: 512 + Math.ceil(script.length / 4),
      },
    };
  },
};
