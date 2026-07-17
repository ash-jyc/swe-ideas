import { useEffect, useState } from 'react';
import type { RunStatus } from '@vibe/shared';
import { RunLogs } from '../RunLogs';
import { api } from '../../lib/api';

export function PreviewTab({
  projectId,
  reloadKey,
  status,
  onStatus,
}: {
  projectId: string;
  reloadKey: number;
  status: RunStatus;
  onStatus: (s: RunStatus) => void;
}) {
  const [iframeKey, setIframeKey] = useState(0);
  const [showLogs, setShowLogs] = useState(false);

  // Reload the iframe whenever a new turn completes.
  useEffect(() => {
    setIframeKey((k) => k + 1);
  }, [reloadKey]);

  // Poll status while it's transitional so the pill stays fresh.
  useEffect(() => {
    if (['starting', 'materializing', 'stopping'].includes(status.state)) {
      const t = setInterval(async () => {
        try {
          onStatus(await api.runStatus(projectId));
        } catch {
          /* ignore */
        }
      }, 1200);
      return () => clearInterval(t);
    }
  }, [status.state, projectId, onStatus]);

  const running = status.state === 'running';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        className="spread"
        style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}
      >
        <span className="chip">
          <span className={`dot ${status.state}`} />
          {status.state}
        </span>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setShowLogs((s) => !s)}>
            {showLogs ? 'Hide logs' : 'Logs'}
          </button>
          <button className="btn btn-sm" onClick={() => setIframeKey((k) => k + 1)}>
            ⟳ Reload
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {running ? (
          <iframe
            key={iframeKey}
            src={`/run/${projectId}/`}
            title="preview"
            style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
          />
        ) : (
          <div
            style={{
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--text-dim)',
              textAlign: 'center',
              padding: 24,
            }}
          >
            <div>
              <div style={{ fontSize: 15, marginBottom: 6 }}>
                {status.state === 'crashed' || status.state === 'error'
                  ? 'The app is not running'
                  : 'Preview not started'}
              </div>
              <div className="faint" style={{ fontSize: 13 }}>
                {status.message ||
                  'Generate an app, then press Run — the live app appears here.'}
              </div>
            </div>
          </div>
        )}
      </div>

      {showLogs && (
        <div style={{ height: 180, borderTop: '1px solid var(--border)' }}>
          <RunLogs projectId={projectId} />
        </div>
      )}
    </div>
  );
}
