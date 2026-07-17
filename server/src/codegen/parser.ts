import type { FileOp, ParsedResponse } from '@vibe/shared';

// The file-op protocol:
//   <vibefile path="rel/path">...full contents...</vibefile>
//   <vibedelete path="rel/path"/>
// Prose outside blocks is the summary.

const FILE_RE = /<vibefile\s+path="([^"]+)"\s*>([\s\S]*?)<\/vibefile>/g;
const DELETE_RE = /<vibedelete\s+path="([^"]+)"\s*\/?>/g;

/**
 * Validate and normalize a model-supplied path. Returns null (and the caller
 * records a warning) for anything unsafe: absolute paths, parent traversal,
 * backslashes, or empty.
 */
export function safePath(raw: string): string | null {
  let p = raw.trim().replace(/\\/g, '/');
  if (!p) return null;
  if (p.startsWith('/')) p = p.replace(/^\/+/, '');
  if (!p) return null;
  const parts = p.split('/');
  if (parts.some((seg) => seg === '..' || seg === '.' || seg === '')) return null;
  if (/^[a-zA-Z]:/.test(raw)) return null; // windows drive
  return parts.join('/');
}

/** Strip a single leading and trailing newline the model tends to add. */
function trimBlock(content: string): string {
  return content.replace(/^\n/, '').replace(/\n[ \t]*$/, '');
}

/**
 * Authoritative parse over the full raw response. This is the source of truth
 * for persistence — the streaming parser below is only for live UI events.
 */
export function parseResponse(raw: string): ParsedResponse {
  const ops: FileOp[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  FILE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FILE_RE.exec(raw)) !== null) {
    const path = safePath(m[1]!);
    if (!path) {
      warnings.push(`Rejected unsafe file path: ${m[1]}`);
      continue;
    }
    ops.push({ op: 'write', path, content: trimBlock(m[2] ?? '') });
    seen.add(path);
  }

  DELETE_RE.lastIndex = 0;
  while ((m = DELETE_RE.exec(raw)) !== null) {
    const path = safePath(m[1]!);
    if (!path) {
      warnings.push(`Rejected unsafe delete path: ${m[1]}`);
      continue;
    }
    if (seen.has(path)) continue; // a write in the same turn wins
    ops.push({ op: 'delete', path });
  }

  // Summary = prose with all blocks removed.
  const summary = raw
    .replace(FILE_RE, '')
    .replace(DELETE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { ops, summary, warnings };
}

export type StreamEvent =
  | { type: 'prose'; text: string }
  | { type: 'file-open'; path: string }
  | { type: 'file-close'; path: string }
  | { type: 'delete'; path: string };

const TAG_PREFIXES = ['<vibefile', '<vibedelete'];

/** Largest suffix of `s` that is a proper prefix of any known opening tag. */
function danglingTagLen(s: string): number {
  for (let keep = Math.min(s.length, 12); keep > 0; keep--) {
    const tail = s.slice(s.length - keep);
    if (TAG_PREFIXES.some((t) => t.startsWith(tail))) return keep;
  }
  return 0;
}

/**
 * Incremental parser for streaming UI feedback. Emits prose deltas plus
 * file-open / file-close / delete markers. Not used for persistence.
 */
export class StreamingParser {
  private buf = '';
  private mode: 'outside' | 'inside' = 'outside';
  private curPath = '';

  feed(chunk: string): StreamEvent[] {
    this.buf += chunk;
    const events: StreamEvent[] = [];
    let progressed = true;
    while (progressed) {
      progressed = false;
      if (this.mode === 'outside') {
        const fileIdx = this.buf.indexOf('<vibefile');
        const delIdx = this.buf.indexOf('<vibedelete');
        const candidates = [fileIdx, delIdx].filter((i) => i >= 0);
        const idx = candidates.length ? Math.min(...candidates) : -1;

        if (idx === -1) {
          const keep = danglingTagLen(this.buf);
          const emit = this.buf.slice(0, this.buf.length - keep);
          if (emit) events.push({ type: 'prose', text: emit });
          this.buf = this.buf.slice(this.buf.length - keep);
          break;
        }

        const before = this.buf.slice(0, idx);
        if (idx === fileIdx && (delIdx < 0 || fileIdx <= delIdx)) {
          const close = this.buf.indexOf('>', idx);
          if (close === -1) {
            if (before) events.push({ type: 'prose', text: before });
            this.buf = this.buf.slice(idx);
            break;
          }
          const openTag = this.buf.slice(idx, close + 1);
          const pm = /path="([^"]+)"/.exec(openTag);
          if (before) events.push({ type: 'prose', text: before });
          this.curPath = pm ? pm[1]! : '(unknown)';
          this.mode = 'inside';
          this.buf = this.buf.slice(close + 1);
          events.push({ type: 'file-open', path: this.curPath });
          progressed = true;
        } else {
          // vibedelete
          const close = this.buf.indexOf('>', idx);
          if (close === -1) {
            if (before) events.push({ type: 'prose', text: before });
            this.buf = this.buf.slice(idx);
            break;
          }
          const tag = this.buf.slice(idx, close + 1);
          const pm = /path="([^"]+)"/.exec(tag);
          if (before) events.push({ type: 'prose', text: before });
          if (pm) events.push({ type: 'delete', path: pm[1]! });
          this.buf = this.buf.slice(close + 1);
          progressed = true;
        }
      } else {
        // inside a file block: wait for </vibefile>
        const closeIdx = this.buf.indexOf('</vibefile>');
        if (closeIdx === -1) {
          // hold back a tail that might be the start of the closing tag
          const keep = Math.min(this.buf.length, '</vibefile>'.length - 1);
          this.buf = this.buf.slice(this.buf.length - keep);
          break;
        }
        events.push({ type: 'file-close', path: this.curPath });
        this.buf = this.buf.slice(closeIdx + '</vibefile>'.length);
        this.mode = 'outside';
        this.curPath = '';
        progressed = true;
      }
    }
    return events;
  }

  end(): StreamEvent[] {
    const events: StreamEvent[] = [];
    if (this.mode === 'outside' && this.buf.trim()) {
      events.push({ type: 'prose', text: this.buf });
    }
    this.buf = '';
    return events;
  }
}
