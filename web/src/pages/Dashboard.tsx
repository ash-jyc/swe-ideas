import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type ProjectSummary } from '../lib/api';
import { IconPlus, IconTrash, IconShield } from '../components/Icons';

function relTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function Dashboard() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const navigate = useNavigate();

  const load = () => api.listProjects().then(setProjects).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name.trim()) return;
    const p = await api.createProject(name.trim());
    navigate(`/p/${p.id}`);
  }

  async function del(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this project and all its data?')) return;
    await api.deleteProject(id);
    load();
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 24px' }}>
      <header className="spread" style={{ marginBottom: 36, alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(160deg, var(--accent), var(--accent-2))',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 8px rgba(0,0,0,0.4)',
              }}
            />
            <h1 style={{ margin: 0, fontSize: 23, fontWeight: 600, letterSpacing: '-0.025em' }}>Vibe</h1>
          </div>
          <p className="muted" style={{ margin: '10px 0 0', fontSize: 14 }}>
            Build full-stack web apps by prompting. Instrumented for security research —
            every prompt → code → vulnerability is recorded.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <IconPlus size={15} /> New project
        </button>
      </header>

      {projects.length === 0 ? (
        <div
          className="card"
          style={{ padding: 56, textAlign: 'center', color: 'var(--text-dim)' }}
        >
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 46,
              height: 46,
              borderRadius: 12,
              margin: '0 auto 14px',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
            }}
          >
            <IconPlus size={22} />
          </div>
          <div style={{ fontSize: 16, marginBottom: 6, color: 'var(--text)' }}>No projects yet</div>
          <div className="faint" style={{ fontSize: 13, marginBottom: 20 }}>
            Create your first app and start prompting.
          </div>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <IconPlus size={15} /> New project
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {projects.map((p) => (
            <Link key={p.id} to={`/p/${p.id}`} className="card project-card" style={cardStyle}>
              <div className="spread" style={{ marginBottom: 10 }}>
                <span className="chip">
                  <span className={`dot ${p.runStatus}`} />
                  {p.runStatus}
                </span>
                <button
                  className="icon-btn"
                  style={{ width: 26, height: 26 }}
                  onClick={(e) => del(p.id, e)}
                  title="Delete"
                >
                  <IconTrash size={14} />
                </button>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, letterSpacing: '-0.01em' }}>
                {p.name}
              </div>
              <div className="faint mono" style={{ fontSize: 11 }}>
                /{p.slug}
              </div>
              <div className="spread" style={{ marginTop: 16, fontSize: 12 }}>
                <span className="muted">{relTime(p.updatedAt)}</span>
                {p.findingCount > 0 && (
                  <span className="chip" style={{ color: 'var(--sev-high)', gap: 4 }}>
                    <IconShield size={11} />
                    {p.findingCount}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <div className="modal-backdrop" onClick={() => setCreating(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New project</h2>
            <div className="sub">Give your app a name. You can prompt it to life next.</div>
            <input
              className="input"
              autoFocus
              placeholder="My awesome app"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="btn btn-ghost" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={create} disabled={!name.trim()}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 18,
  display: 'block',
  transition: 'border-color 0.15s, transform 0.1s',
};
