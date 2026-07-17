import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ProjectDetail, Turn, RunStatus } from '@vibe/shared';
import { PROVIDER_PRESETS } from '@vibe/shared';
import { api } from '../lib/api';
import { useCredentials, credsReady } from '../lib/keys';
import { ChatPanel } from '../components/ChatPanel';
import { Toolbar } from '../components/Toolbar';
import { SettingsModal } from '../components/SettingsModal';
import { DeployDialog } from '../components/DeployDialog';
import { GithubDialog } from '../components/GithubDialog';
import { PreviewTab } from '../components/tabs/PreviewTab';
import { CodeTab } from '../components/tabs/CodeTab';
import { HistoryTab } from '../components/tabs/HistoryTab';
import { SecurityTab } from '../components/tabs/SecurityTab';
import type { ComponentType } from 'react';
import {
  IconArrowLeft,
  IconEye,
  IconCode,
  IconHistory,
  IconShield,
} from '../components/Icons';

type Tab = 'preview' | 'code' | 'history' | 'security';
type IconType = ComponentType<{ size?: number }>;
const TABS: { id: Tab; label: string; icon: IconType }[] = [
  { id: 'preview', label: 'Preview', icon: IconEye },
  { id: 'code', label: 'Code', icon: IconCode },
  { id: 'history', label: 'History', icon: IconHistory },
  { id: 'security', label: 'Security', icon: IconShield },
];

export function Workspace() {
  const { id } = useParams<{ id: string }>();
  const projectId = id!;
  const credentials = useCredentials();
  const ready = credsReady(credentials);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [tab, setTab] = useState<Tab>('preview');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [showSettings, setShowSettings] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [showGithub, setShowGithub] = useState(false);

  const loadProject = useCallback(async () => {
    const [detail, turnList] = await Promise.all([
      api.getProject(projectId),
      api.listTurns(projectId),
    ]);
    setProject(detail);
    setTurns(turnList);
    setRunStatus(detail.runStatus);
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const onTurnComplete = useCallback(async () => {
    await loadProject();
    setReloadKey((k) => k + 1);
  }, [loadProject]);

  async function onRun() {
    try {
      setRunStatus(await api.run(projectId));
      setReloadKey((k) => k + 1);
    } catch {
      /* ignore */
    }
  }
  async function onStop() {
    try {
      setRunStatus(await api.stop(projectId));
    } catch {
      /* ignore */
    }
  }

  function jump(file: string) {
    setSelectedFile(file);
    setTab('code');
  }

  const running = runStatus?.state === 'running';
  const providerLabel =
    PROVIDER_PRESETS.find((p) => p.id === credentials?.provider)?.label ?? 'Model';

  if (!project) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }} className="faint">
        Loading…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header
        className="spread"
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-1)',
          flexShrink: 0,
        }}
      >
        <div className="row" style={{ alignItems: 'center', gap: 12 }}>
          <Link to="/" className="btn btn-sm btn-ghost">
            <IconArrowLeft size={14} /> Projects
          </Link>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{project.name}</div>
            <div className="faint mono" style={{ fontSize: 10.5 }}>
              /{project.slug}
            </div>
          </div>
        </div>
        <Toolbar
          runState={runStatus?.state ?? 'idle'}
          running={running}
          onRun={onRun}
          onStop={onStop}
          onDeploy={() => setShowDeploy(true)}
          onGithub={() => setShowGithub(true)}
          onSettings={() => setShowSettings(true)}
          providerLabel={providerLabel}
        />
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside
          style={{
            width: 380,
            borderRight: '1px solid var(--border)',
            flexShrink: 0,
            background: 'var(--bg-1)',
          }}
        >
          <ChatPanel
            projectId={projectId}
            credentials={credentials}
            ready={ready}
            onTurnComplete={onTurnComplete}
            onOpenSettings={() => setShowSettings(true)}
          />
        </aside>

        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <nav
            style={{
              display: 'flex',
              padding: '10px 12px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div className="segmented">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? 'active' : ''}
                onClick={() => setTab(t.id)}
              >
                <t.icon size={14} />
                {t.label}
                {t.id === 'security' && project.findingCount > 0 && (
                  <span className="chip" style={{ padding: '1px 6px', color: 'var(--sev-high)' }}>
                    {project.findingCount}
                  </span>
                )}
              </button>
            ))}
            </div>
          </nav>

          <div style={{ flex: 1, minHeight: 0 }}>
            {tab === 'preview' && runStatus && (
              <PreviewTab
                projectId={projectId}
                reloadKey={reloadKey}
                status={runStatus}
                onStatus={setRunStatus}
              />
            )}
            {tab === 'code' && (
              <CodeTab
                projectId={projectId}
                fileTree={project.fileTree}
                selected={selectedFile}
                onSelect={setSelectedFile}
              />
            )}
            {tab === 'history' && <HistoryTab projectId={projectId} turns={turns} />}
            {tab === 'security' && (
              <SecurityTab projectId={projectId} turns={turns} onJump={jump} />
            )}
          </div>
        </main>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showDeploy && (
        <DeployDialog
          projectId={projectId}
          defaultSlug={project.slug}
          onClose={() => setShowDeploy(false)}
        />
      )}
      {showGithub && (
        <GithubDialog
          projectId={projectId}
          defaultRepo={project.slug}
          onClose={() => setShowGithub(false)}
        />
      )}
    </div>
  );
}
