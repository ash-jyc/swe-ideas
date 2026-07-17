import { useEffect, useRef, useState } from 'react';
import type { ByokCredentials, GenerateEvent } from '@vibe/shared';
import { streamGenerate } from '../lib/sse';
import { api } from '../lib/api';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  files: { op: 'write' | 'delete'; path: string }[];
  status: 'streaming' | 'done' | 'error';
}

export function ChatPanel({
  projectId,
  credentials,
  ready,
  onTurnComplete,
  onOpenSettings,
}: {
  projectId: string;
  credentials: ByokCredentials | null;
  ready: boolean;
  onTurnComplete: () => void;
  onOpenSettings: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.listTurns(projectId).then((turns) => {
      const msgs: Msg[] = [];
      for (const t of turns) {
        msgs.push({ role: 'user', text: t.prompt, files: [], status: 'done' });
        msgs.push({
          role: 'assistant',
          text: t.summary || '(updated the project)',
          files: [],
          status: t.status === 'error' ? 'error' : 'done',
        });
      }
      setMessages(msgs);
    });
  }, [projectId]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  async function send() {
    const prompt = input.trim();
    if (!prompt || busy || !credentials) return;
    setInput('');
    setBusy(true);
    setMessages((m) => [
      ...m,
      { role: 'user', text: prompt, files: [], status: 'done' },
      { role: 'assistant', text: '', files: [], status: 'streaming' },
    ]);

    const update = (fn: (m: Msg) => Msg) =>
      setMessages((msgs) => {
        const copy = [...msgs];
        const last = copy.length - 1;
        copy[last] = fn(copy[last]!);
        return copy;
      });

    try {
      await streamGenerate(projectId, prompt, credentials, (e: GenerateEvent) => {
        if (e.type === 'token') update((m) => ({ ...m, text: m.text + e.text }));
        else if (e.type === 'file-op')
          update((m) => ({ ...m, files: [...m.files, { op: e.op, path: e.path }] }));
        else if (e.type === 'done') {
          update((m) => ({ ...m, status: 'done' }));
          onTurnComplete();
        } else if (e.type === 'error') {
          update((m) => ({ ...m, status: 'error', text: m.text + '\n\n⚠ ' + e.message }));
        }
      });
    } catch (err) {
      update((m) => ({
        ...m,
        status: 'error',
        text: m.text + '\n\n⚠ ' + (err instanceof Error ? err.message : String(err)),
      }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '16px 14px' }}>
        {messages.length === 0 && (
          <div className="faint" style={{ fontSize: 13, lineHeight: 1.6, padding: 8 }}>
            Describe the web app you want to build. The model generates a full-stack app
            (Express backend + database + frontend). Every prompt, response, and diff is
            recorded for security research.
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} msg={m} />
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', padding: 12 }}>
        {!ready && (
          <div
            className="muted"
            style={{ fontSize: 12.5, marginBottom: 8, display: 'flex', gap: 6 }}
          >
            Set your model & key to start.
            <button className="btn-ghost" style={{ color: 'var(--accent)' }} onClick={onOpenSettings}>
              Open settings
            </button>
          </div>
        )}
        <textarea
          className="input mono"
          rows={3}
          placeholder="e.g. build a URL shortener with click analytics"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
          }}
          disabled={busy || !ready}
          style={{ fontSize: 13 }}
        />
        <div className="spread" style={{ marginTop: 8 }}>
          <span className="faint" style={{ fontSize: 11 }}>
            ⌘/Ctrl + Enter to send
          </span>
          <button className="btn btn-primary btn-sm" onClick={send} disabled={busy || !ready || !input.trim()}>
            {busy ? 'Generating…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        className="faint"
        style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}
      >
        {isUser ? 'You' : 'Vibe'}
      </div>
      <div
        style={{
          background: isUser ? 'var(--bg-3)' : 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 13.5,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: msg.status === 'error' ? 'var(--bad)' : 'var(--text)',
        }}
      >
        {msg.text || (msg.status === 'streaming' ? '▍' : '')}
      </div>
      {msg.files.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
          {msg.files.map((f, i) => (
            <span key={i} className="chip mono" style={{ fontSize: 10.5 }}>
              {f.op === 'delete' ? '🗑' : '✎'} {f.path}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
