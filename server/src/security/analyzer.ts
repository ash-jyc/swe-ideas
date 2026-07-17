import type {
  AnalyzerRequest,
  AnalyzerResult,
  AnalyzerInfo,
} from '@vibe/shared';

/**
 * The plug-in contract for security analysis.
 *
 * A real AI security agent is added later by implementing this interface and
 * calling `registerAnalyzer()` at server boot — no schema, endpoint, or UI
 * changes are needed. The analyzer receives the prompt, the full file set as of
 * a turn, and that turn's diff, so it can attribute findings to the prompt that
 * produced the code.
 */
export interface SecurityAnalyzer {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  analyze(req: AnalyzerRequest): Promise<AnalyzerResult>;
}

const registry = new Map<string, SecurityAnalyzer>();
let defaultId: string | null = null;

export function registerAnalyzer(analyzer: SecurityAnalyzer, asDefault = false): void {
  registry.set(analyzer.id, analyzer);
  if (asDefault || defaultId === null) defaultId = analyzer.id;
}

export function getAnalyzer(id?: string): SecurityAnalyzer {
  const key = id ?? defaultId;
  const analyzer = key ? registry.get(key) : undefined;
  if (!analyzer) throw new Error(`No analyzer registered${id ? `: ${id}` : ''}`);
  return analyzer;
}

export function listAnalyzers(): AnalyzerInfo[] {
  return [...registry.values()].map((a) => ({
    id: a.id,
    name: a.name,
    version: a.version,
  }));
}
