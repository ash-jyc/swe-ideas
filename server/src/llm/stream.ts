// Shared parser for provider SSE streams. Yields the payload of each `data:`
// line (concatenating multi-line data fields per the SSE spec).

export async function* sseData(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      // Events are separated by a blank line.
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLines = rawEvent
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).replace(/^ /, ''));
        if (dataLines.length) yield dataLines.join('\n');
      }
    }
    // flush any trailing event without a terminating blank line
    const tail = buffer.trim();
    if (tail) {
      const dataLines = tail
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).replace(/^ /, ''));
      if (dataLines.length) yield dataLines.join('\n');
    }
  } finally {
    reader.releaseLock();
  }
}
