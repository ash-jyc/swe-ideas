import { useEffect, useMemo, useState } from 'react';
import type { SecurityFinding, Turn, AnalyzerInfo } from '@vibe/shared';
import { SEVERITY_ORDER } from '@vibe/shared';
import { FindingCard } from '../FindingCard';
import { api } from '../../lib/api';

export function SecurityTab({
  projectId,
  turns,
  onJump,
}: {
  projectId: string;
  turns: Turn[];
  onJump: (file: string, line: number) => void;
}) {
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [analyzers, setAnalyzers] = useState<AnalyzerInfo[]>([]);
  const [analyzer, setAnalyzer] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = () => api.findings(projectId).then(setFindings).catch(() => {});

  useEffect(() => {
    refresh();
    api.analyzers().then((a) => {
      setAnalyzers(a);
      if (a[0]) setAnalyzer(a[0].id);
    });
  }, [projectId]);

  const latestTurn = turns.filter((t) => t.status === 'complete').slice(-1)[0];
  const turnLabel = useMemo(() => {
    const map = new Map<string, Turn>();
    for (const t of turns) map.set(t.id, t);
    return map;
  }, [turns]);

  async function analyze(turnId?: string) {
    setBusy(true);
    setNote(null);
    try {
      const run = await api.analyze(projectId, turnId, analyzer || undefined);
      // Poll until the analysis completes.
      for (let i = 0; i < 40; i++) {
        const status = await api.analysisRun(run.id);
        if (status.status === 'complete') {
          setNote(`Found ${status.findingCount} finding(s).`);
          break;
        }
        if (status.status === 'error') {
          setNote(`Analysis error: ${status.error}`);
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const g = new Map<string, SecurityFinding[]>();
    for (const f of findings) {
      const key = f.turnId ?? 'project';
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(f);
    }
    for (const list of g.values()) {
      list.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    }
    return g;
  }, [findings]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}
      >
        <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <select
            className="input"
            style={{ width: 'auto', padding: '6px 10px', fontSize: 12.5 }}
            value={analyzer}
            onChange={(e) => setAnalyzer(e.target.value)}
          >
            {analyzers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} v{a.version}
              </option>
            ))}
          </select>
          <button
            className="btn btn-sm btn-primary"
            disabled={busy || !latestTurn}
            onClick={() => analyze(latestTurn?.id)}
          >
            {busy ? 'Analyzing…' : 'Analyze latest turn'}
          </button>
          <button className="btn btn-sm" disabled={busy} onClick={() => analyze(undefined)}>
            Analyze whole project
          </button>
          {note && <span className="faint" style={{ fontSize: 12 }}>{note}</span>}
        </div>
        <div className="faint" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
          The bundled scanner is a placeholder. Plug in a real AI security agent by implementing the
          analyzer interface — findings stay linked to the prompt that produced the code.
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
        {findings.length === 0 && (
          <div className="faint" style={{ fontSize: 13 }}>
            No findings yet. Run an analysis above.
          </div>
        )}
        {[...grouped.entries()].map(([turnId, list]) => {
          const t = turnLabel.get(turnId);
          return (
            <div key={turnId} style={{ marginBottom: 18 }}>
              <div
                className="spread"
                style={{ marginBottom: 8, alignItems: 'baseline' }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-dim)' }}>
                  {t ? `Turn #${t.seq}` : 'Whole project'}
                  {t && (
                    <span className="faint" style={{ fontWeight: 400 }}>
                      {' — '}
                      {t.prompt.slice(0, 70)}
                      {t.prompt.length > 70 ? '…' : ''}
                    </span>
                  )}
                </div>
                <span className="chip">{list.length}</span>
              </div>
              {list.map((f) => (
                <FindingCard key={f.id} finding={f} onJump={onJump} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
