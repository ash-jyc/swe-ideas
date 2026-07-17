import { useEffect, useRef, useState } from 'react';
import type { RunLogEvent } from '@vibe/shared';
import { streamLogs } from '../lib/sse';

export function RunLogs({ projectId }: { projectId: string }) {
  const [lines, setLines] = useState<RunLogEvent[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLines([]);
    const stop = streamLogs(projectId, (e) => {
      setLines((prev) => (prev.length > 500 ? [...prev.slice(-400), e] : [...prev, e]));
    });
    return stop;
  }, [projectId]);

  useEffect(() => {
    boxRef.current?.scrollTo(0, boxRef.current.scrollHeight);
  }, [lines]);

  return (
    <div
      ref={boxRef}
      className="mono"
      style={{
        height: '100%',
        overflow: 'auto',
        padding: '10px 12px',
        fontSize: 12,
        lineHeight: 1.55,
        background: 'var(--bg)',
      }}
    >
      {lines.length === 0 && <div className="faint">Waiting for logs…</div>}
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            color:
              l.stream === 'stderr'
                ? 'var(--bad)'
                : l.stream === 'system'
                  ? 'var(--accent)'
                  : 'var(--text-dim)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {l.line}
        </div>
      ))}
    </div>
  );
}
