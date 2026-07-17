import { useState } from 'react';
import { api } from '../lib/api';

export function GithubDialog({
  projectId,
  defaultRepo,
  onClose,
}: {
  projectId: string;
  defaultRepo: string;
  onClose: () => void;
}) {
  const [token, setToken] = useState('');
  const [repoName, setRepoName] = useState(defaultRepo);
  const [isPrivate, setIsPrivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState<string | null>(null);

  async function push() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.githubExport(projectId, token.trim(), repoName.trim(), isPrivate);
      setRepoUrl(r.repoUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Push to GitHub</h2>
        <div className="sub">
          Creates a new repository and pushes your generated project in a single commit. Your
          token is used only for this request and never stored.
        </div>

        {!repoUrl ? (
          <>
            <div className="field">
              <label className="label">Repository name</label>
              <input
                className="input mono"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label">
                Personal access token <span className="faint">(scope: repo)</span>
              </label>
              <input
                className="input mono"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_… or github_pat_…"
                autoComplete="off"
              />
            </div>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 14 }}
            >
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              Private repository
            </label>
            {error && (
              <div style={{ color: 'var(--bad)', fontSize: 13, marginBottom: 12 }}>{error}</div>
            )}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={push}
                disabled={busy || !token || !repoName}
              >
                {busy ? 'Pushing…' : 'Create & push'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label className="label">Pushed to</label>
              <a className="mono" href={repoUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                {repoUrl}
              </a>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
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
