import type { RunStatus } from '@vibe/shared';
import {
  IconPlay,
  IconStop,
  IconGithub,
  IconDeploy,
  IconSettings,
} from './Icons';

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
      <span className="chip" title="Preview status" style={{ textTransform: 'capitalize' }}>
        <span className={`dot ${runState}`} />
        {runState}
      </span>
      {running ? (
        <button className="btn btn-sm" onClick={onStop}>
          <IconStop size={13} /> Stop
        </button>
      ) : (
        <button className="btn btn-sm" onClick={onRun}>
          <IconPlay size={13} /> Run
        </button>
      )}
      <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
      <button className="btn btn-sm btn-ghost" onClick={onSettings} title="Model settings">
        <IconSettings size={14} /> {providerLabel}
      </button>
      <button className="btn btn-sm" onClick={onGithub}>
        <IconGithub size={14} /> GitHub
      </button>
      <button className="btn btn-sm btn-primary" onClick={onDeploy}>
        <IconDeploy size={14} /> Deploy
      </button>
    </div>
  );
}
