import type { SecurityFinding } from '@vibe/shared';

interface Props {
  finding: SecurityFinding;
  onJump?: (file: string, line: number) => void;
}

export function FindingCard({ finding, onJump }: Props) {
  const loc = finding.file
    ? `${finding.file}${finding.lineStart ? `:${finding.lineStart}` : ''}`
    : null;
  return (
    <div className="card" style={{ padding: 14, marginBottom: 10 }}>
      <div className="spread" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`sev sev-${finding.severity}`}>{finding.severity}</span>
          {finding.cwe && <span className="chip">{finding.cwe}</span>}
        </div>
        {loc && (
          <button
            className="mono faint"
            style={{ fontSize: 12 }}
            onClick={() => onJump?.(finding.file!, finding.lineStart ?? 1)}
            title="Jump to code"
          >
            {loc}
          </button>
        )}
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{finding.title}</div>
      <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
        {finding.description}
      </div>
      {finding.metadata?.snippet ? (
        <pre
          className="mono"
          style={{
            marginTop: 10,
            marginBottom: 0,
            padding: '8px 10px',
            background: 'var(--bg)',
            borderRadius: 6,
            fontSize: 12,
            overflow: 'auto',
            color: 'var(--text-dim)',
          }}
        >
          {String(finding.metadata.snippet)}
        </pre>
      ) : null}
    </div>
  );
}
