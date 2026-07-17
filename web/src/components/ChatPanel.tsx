import { useEffect, useRef, useState } from 'react';
import type { ByokCredentials, GenerateEvent } from '@vibe/shared';
import { streamGenerate } from '../lib/sse';
import { api } from '../lib/api';
import { IconSend, IconSparkle } from './Icons';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  files: { op: 'write' | 'delete'; path: string }[];
  status: 'streaming' | 'done' | 'error';
}

const SUGGESTIONS = [
  'A URL shortener with click analytics',
  'A team todo board with due dates',
  'A personal expense tracker with charts',
  'A public guestbook with search',
];

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

  async function runPrompt(prompt: string) {
    if (!prompt.trim() || busy || !credentials) return;
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

  const empty = messages.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '16px 14px' }}>
        {empty && (
          <div>
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 40,
                height: 40,
                borderRadius: 11,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                marginBottom: 12,
              }}
            >
              <IconSparkle size={20} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
              Build a full-stack app
            </div>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              Describe what you want. The model generates a real Express + database + frontend app —
              and every prompt, response, and diff is recorded for security research.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="suggest"
                  disabled={!ready}
                  onClick={() => runPrompt(s)}
                >
                  <IconSparkle size={13} />
                  {s}
                </button>
              ))}
            </div>
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
        <div style={{ position: 'relative' }}>
          <textarea
            className="input"
            rows={3}
            placeholder="Describe an app, or ask for a change…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runPrompt(input);
            }}
            disabled={busy || !ready}
            style={{ fontSize: 13, paddingRight: 44 }}
          />
          <button
            className="btn btn-primary"
            onClick={() => runPrompt(input)}
            disabled={busy || !ready || !input.trim()}
            title="Send (⌘/Ctrl + Enter)"
            style={{ position: 'absolute', right: 8, bottom: 8, padding: '7px 9px' }}
          >
            <IconSend size={15} />
          </button>
        </div>
        <div className="faint" style={{ fontSize: 11, marginTop: 7 }}>
          {busy ? 'Generating…' : '⌘/Ctrl + Enter to send'}
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10.5,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 5,
          color: isUser ? 'var(--text-faint)' : 'var(--accent)',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: isUser ? 'var(--text-faint)' : 'var(--accent)',
          }}
        />
        {isUser ? 'You' : 'Vibe'}
      </div>
      <div
        style={{
          background: isUser ? 'var(--bg-2)' : 'var(--bg-1)',
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
        {msg.text ? (
          msg.text
        ) : msg.status === 'streaming' ? (
          <span className="typing">
            <span />
            <span />
            <span />
          </span>
        ) : (
          ''
        )}
      </div>
      {msg.files.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
          {msg.files.map((f, i) => (
            <span key={i} className="chip mono" style={{ fontSize: 10.5 }}>
              {f.op === 'delete' ? '−' : '+'} {f.path}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
