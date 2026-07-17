import { useEffect, useState } from 'react';
import type { RunStatus } from '@vibe/shared';
import { RunLogs } from '../RunLogs';
import { api } from '../../lib/api';
import { IconReload, IconExternal, IconTerminal, IconEye } from '../Icons';

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

  useEffect(() => {
    setIframeKey((k) => k + 1);
  }, [reloadKey]);

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
  const previewUrl = `/run/${projectId}/`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 14, gap: 12 }}>
      <div className="browser">
        {/* chrome bar */}
        <div className="browser-bar">
          <div className="traffic">
            <span style={{ background: '#ff5f57' }} />
            <span style={{ background: '#febc2e' }} />
            <span style={{ background: '#28c840' }} />
          </div>
          <button
            className="icon-btn"
            title="Reload preview"
            onClick={() => setIframeKey((k) => k + 1)}
            disabled={!running}
          >
            <IconReload size={14} />
          </button>
          <div className="addr">
            <span className={`dot ${status.state}`} style={{ flexShrink: 0 }} />
            <span className="mono addr-text">{previewUrl}</span>
          </div>
          <button
            className={`icon-btn ${showLogs ? 'active' : ''}`}
            title="Toggle run logs"
            onClick={() => setShowLogs((s) => !s)}
          >
            <IconTerminal size={14} />
          </button>
          <a
            className="icon-btn"
            title="Open in a new tab"
            href={running ? previewUrl : undefined}
            target="_blank"
            rel="noreferrer"
            style={running ? {} : { pointerEvents: 'none', opacity: 0.4 }}
          >
            <IconExternal size={14} />
          </a>
        </div>

        {/* viewport */}
        <div className="browser-view">
          {running ? (
            <iframe
              key={iframeKey}
              src={previewUrl}
              title="preview"
              style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
            />
          ) : (
            <div className="preview-empty">
              <div className="preview-empty-icon">
                <IconEye size={26} />
              </div>
              <div style={{ fontSize: 15, marginBottom: 6, color: 'var(--text)' }}>
                {status.state === 'crashed' || status.state === 'error'
                  ? 'The app isn’t running'
                  : status.state === 'starting' || status.state === 'materializing'
                    ? 'Starting your app…'
                    : 'Preview not started'}
              </div>
              <div className="faint" style={{ fontSize: 13, maxWidth: 340, lineHeight: 1.5 }}>
                {status.message ||
                  'Generate an app in the chat, then press Run — the live app appears here.'}
              </div>
            </div>
          )}
        </div>
      </div>

      {showLogs && (
        <div className="card" style={{ height: 180, overflow: 'hidden', flexShrink: 0 }}>
          <RunLogs projectId={projectId} />
        </div>
      )}
    </div>
  );
}
