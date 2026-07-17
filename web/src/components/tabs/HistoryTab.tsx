import { useEffect, useState } from 'react';
import type { Turn, TurnDetail, TurnDiffResponse } from '@vibe/shared';
import { DiffViewer } from '../DiffViewer';
import { api } from '../../lib/api';

export function HistoryTab({
  projectId,
  turns,
}: {
  projectId: string;
  turns: Turn[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<TurnDetail | null>(null);
  const [diff, setDiff] = useState<TurnDiffResponse | null>(null);
  const [diffFile, setDiffFile] = useState<string | null>(null);
  const [view, setView] = useState<'diff' | 'raw'>('diff');

  useEffect(() => {
    if (!selected && turns.length) setSelected(turns[turns.length - 1]!.id);
  }, [turns, selected]);

  useEffect(() => {
    if (!selected) return;
    Promise.all([api.getTurn(projectId, selected), api.getTurnDiff(projectId, selected)]).then(
      ([d, df]) => {
        setDetail(d);
        setDiff(df);
        setDiffFile(df.files[0]?.path ?? null);
      },
    );
  }, [projectId, selected]);

  const activeDiff = diff?.files.find((f) => f.path === diffFile) ?? null;

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div
        style={{
          width: 260,
          borderRight: '1px solid var(--border)',
          overflow: 'auto',
          flexShrink: 0,
        }}
      >
        {turns.length === 0 && (
          <div className="faint" style={{ padding: 14, fontSize: 13 }}>
            No turns yet.
          </div>
        )}
        {[...turns].reverse().map((t) => (
          <div
            key={t.id}
            onClick={() => setSelected(t.id)}
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              background: selected === t.id ? 'var(--bg-3)' : 'transparent',
            }}
          >
            <div className="spread">
              <span className="chip">#{t.seq}</span>
              <span className="faint" style={{ fontSize: 11 }}>
                {t.usage.totalTokens ? `${t.usage.totalTokens} tok` : ''}
              </span>
            </div>
            <div
              style={{
                fontSize: 13,
                marginTop: 6,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: t.status === 'error' ? 'var(--bad)' : 'var(--text)',
              }}
            >
              {t.prompt}
            </div>
            <div className="faint mono" style={{ fontSize: 10.5, marginTop: 4 }}>
              {t.provider}/{t.model}
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {detail ? (
          <>
            <div
              className="spread"
              style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', gap: 8 }}
            >
              <div className="row" style={{ gap: 6 }}>
                <button
                  className={`btn btn-sm ${view === 'diff' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setView('diff')}
                >
                  Diff
                </button>
                <button
                  className={`btn btn-sm ${view === 'raw' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setView('raw')}
                >
                  Raw response
                </button>
              </div>
              {view === 'diff' && diff && diff.files.length > 0 && (
                <select
                  className="input mono"
                  style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }}
                  value={diffFile ?? ''}
                  onChange={(e) => setDiffFile(e.target.value)}
                >
                  {diff.files.map((f) => (
                    <option key={f.path} value={f.path}>
                      {f.op === 'delete' ? '🗑 ' : ''}
                      {f.path}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {view === 'raw' ? (
                <pre
                  className="mono"
                  style={{
                    height: '100%',
                    margin: 0,
                    overflow: 'auto',
                    padding: 14,
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                    color: 'var(--text-dim)',
                  }}
                >
                  {detail.rawResponse || '(empty)'}
                </pre>
              ) : activeDiff ? (
                <DiffViewer before={activeDiff.before} after={activeDiff.after} />
              ) : (
                <div style={{ display: 'grid', placeItems: 'center', height: '100%' }} className="faint">
                  No file changes in this turn.
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%' }} className="faint">
            Select a turn to inspect its prompt, diff, and raw model response.
          </div>
        )}
      </div>
    </div>
  );
}
