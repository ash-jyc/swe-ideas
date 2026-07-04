/**
 * Agents are told to reply with pure JSON, but models sometimes wrap it in a
 * fenced block or a sentence. Extract the first parseable JSON object.
 */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();

  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  const candidates: string[] = [];
  if (fence?.[1]) candidates.push(fence[1].trim());
  candidates.push(trimmed);

  const start = trimmed.indexOf('{');
  if (start >= 0) {
    // Walk to the matching close brace, respecting strings.
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = !inString;
      if (inString) continue;
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          candidates.push(trimmed.slice(start, i + 1));
          break;
        }
      }
    }
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next candidate
    }
  }
  throw new Error(`could not extract JSON from agent response: ${trimmed.slice(0, 200)}`);
}
