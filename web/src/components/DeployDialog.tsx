import { useState } from 'react';
import { api } from '../lib/api';

export function DeployDialog({
  projectId,
  defaultSlug,
  onClose,
}: {
  projectId: string;
  defaultSlug: string;
  onClose: () => void;
}) {
  const [slug, setSlug] = useState(defaultSlug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  async function deploy() {
    setBusy(true);
    setError(null);
    try {
      const d = await api.deploy(projectId, slug.trim() || undefined);
      setUrl(new URL(d.url, location.origin).href);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Deploy</h2>
        <div className="sub">
          Publish a live snapshot of your app to a shareable URL, served by the platform. One
          click — no accounts or tokens.
        </div>

        {!url ? (
          <>
            <div className="field">
              <label className="label">Address</label>
              <div
                className="row"
                style={{ alignItems: 'center', gap: 6, fontSize: 13 }}
              >
                <span className="faint mono">/sites/</span>
                <input
                  className="input mono"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>
            </div>
            {error && (
              <div style={{ color: 'var(--bad)', fontSize: 13, marginBottom: 12 }}>{error}</div>
            )}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={deploy} disabled={busy}>
                {busy ? 'Deploying…' : 'Deploy'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label className="label">Live at</label>
              <a className="mono" href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                {url}
              </a>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => navigator.clipboard?.writeText(url)}>
                Copy link
              </button>
              <button className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
