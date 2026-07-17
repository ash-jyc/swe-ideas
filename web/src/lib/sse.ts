import type { GenerateEvent, RunLogEvent, ByokCredentials } from '@vibe/shared';

/** Read a `data: {json}` SSE stream from a fetch Response body. */
async function readSse<T>(
  body: ReadableStream<Uint8Array>,
  onEvent: (e: T) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            onEvent(JSON.parse(payload) as T);
          } catch {
            /* ignore malformed */
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** POST the generate request and stream GenerateEvents. */
export async function streamGenerate(
  projectId: string,
  prompt: string,
  credentials: ByokCredentials,
  onEvent: (e: GenerateEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, credentials }),
    signal,
  });
  if (!res.ok || !res.body) {
    let msg = `Generation failed (${res.status})`;
    try {
      const b = await res.json();
      if (b?.error) msg = b.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  await readSse<GenerateEvent>(res.body, onEvent, signal);
}

/** Subscribe to a project's run logs. Returns an unsubscribe function. */
export function streamLogs(
  projectId: string,
  onLine: (e: RunLogEvent) => void,
): () => void {
  const ctrl = new AbortController();
  (async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/run/logs`, {
        signal: ctrl.signal,
      });
      if (res.body) await readSse<RunLogEvent>(res.body, onLine, ctrl.signal);
    } catch {
      /* aborted or network */
    }
  })();
  return () => ctrl.abort();
}
