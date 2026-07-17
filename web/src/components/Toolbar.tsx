import type { RunStatus } from '@vibe/shared';

export function Toolbar({
  runState,
  running,
  onRun,
  onStop,
  onDeploy,
  onGithub,
  onSettings,
  providerLabel,
}: {
  runState: RunStatus['state'];
  running: boolean;
  onRun: () => void;
  onStop: () => void;
  onDeploy: () => void;
  onGithub: () => void;
  onSettings: () => void;
  providerLabel: string;
}) {
  return (
    <div className="row" style={{ alignItems: 'center', gap: 8 }}>
      <span className="chip" title="Preview status">
        <span className={`dot ${runState}`} />
        {runState}
      </span>
      {running ? (
        <button className="btn btn-sm" onClick={onStop}>
          ■ Stop
        </button>
      ) : (
        <button className="btn btn-sm" onClick={onRun}>
          ▶ Run
        </button>
      )}
      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
      <button className="btn btn-sm" onClick={onGithub}>
        ⭙ GitHub
      </button>
      <button className="btn btn-sm btn-primary" onClick={onDeploy}>
        ⬆ Deploy
      </button>
      <button className="btn btn-sm btn-ghost" onClick={onSettings} title="Model settings">
        ⚙ {providerLabel}
      </button>
    </div>
  );
}
