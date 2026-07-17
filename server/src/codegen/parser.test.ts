import { describe, it, expect } from 'vitest';
import { parseResponse, safePath, StreamingParser } from './parser.js';

describe('safePath', () => {
  it('accepts normal relative paths', () => {
    expect(safePath('server.js')).toBe('server.js');
    expect(safePath('public/app.js')).toBe('public/app.js');
  });
  it('strips leading slashes', () => {
    expect(safePath('/server.js')).toBe('server.js');
  });
  it('rejects parent traversal', () => {
    expect(safePath('../secrets')).toBeNull();
    expect(safePath('a/../../b')).toBeNull();
  });
  it('rejects windows drive paths', () => {
    expect(safePath('C:\\evil')).toBeNull();
  });
});

describe('parseResponse', () => {
  it('extracts a single file write and the summary', () => {
    const raw = 'Here you go.\n<vibefile path="server.js">\nconsole.log(1)\n</vibefile>\nDone!';
    const r = parseResponse(raw);
    expect(r.ops).toEqual([{ op: 'write', path: 'server.js', content: 'console.log(1)' }]);
    expect(r.summary).toContain('Here you go.');
    expect(r.summary).toContain('Done!');
    expect(r.summary).not.toContain('vibefile');
  });

  it('parses multiple files and a delete', () => {
    const raw =
      '<vibefile path="a.js">a</vibefile><vibefile path="b/c.css">x</vibefile><vibedelete path="old.js"/>';
    const r = parseResponse(raw);
    expect(r.ops).toHaveLength(3);
    expect(r.ops.filter((o) => o.op === 'write')).toHaveLength(2);
    expect(r.ops.find((o) => o.op === 'delete')).toMatchObject({ path: 'old.js' });
  });

  it('rejects unsafe paths with a warning', () => {
    const raw = '<vibefile path="../../etc/passwd">x</vibefile>';
    const r = parseResponse(raw);
    expect(r.ops).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('lets a write win over a delete of the same path', () => {
    const raw = '<vibefile path="x.js">new</vibefile><vibedelete path="x.js"/>';
    const r = parseResponse(raw);
    expect(r.ops).toEqual([{ op: 'write', path: 'x.js', content: 'new' }]);
  });

  it('preserves inner content exactly (minus one leading/trailing newline)', () => {
    const raw = '<vibefile path="x.txt">\nline1\nline2\n</vibefile>';
    const r = parseResponse(raw);
    expect(r.ops[0]).toMatchObject({ content: 'line1\nline2' });
  });
});

describe('StreamingParser', () => {
  function feedAll(chunks: string[]) {
    const p = new StreamingParser();
    const events = chunks.flatMap((c) => p.feed(c));
    return [...events, ...p.end()];
  }

  it('emits prose then file-open/close for a whole-string feed', () => {
    const events = feedAll(['Hi.<vibefile path="a.js">code</vibefile>bye']);
    const types = events.map((e) => e.type);
    expect(types).toContain('file-open');
    expect(types).toContain('file-close');
    const open = events.find((e) => e.type === 'file-open');
    expect(open).toMatchObject({ path: 'a.js' });
  });

  it('handles a tag split across chunk boundaries', () => {
    const events = feedAll(['prose <vibe', 'file path="x', '.js">body</vibe', 'file>tail']);
    const open = events.find((e) => e.type === 'file-open');
    const close = events.find((e) => e.type === 'file-close');
    expect(open).toMatchObject({ path: 'x.js' });
    expect(close).toBeTruthy();
    const prose = events.filter((e) => e.type === 'prose').map((e: any) => e.text).join('');
    expect(prose).toContain('prose');
    expect(prose).toContain('tail');
  });

  it('emits a delete event', () => {
    const events = feedAll(['<vibedelete path="gone.js"/>']);
    expect(events.find((e) => e.type === 'delete')).toMatchObject({ path: 'gone.js' });
  });

  it('does not leak partial opening tags as prose', () => {
    const p = new StreamingParser();
    const first = p.feed('hello <vibe');
    const proseText = first
      .filter((e) => e.type === 'prose')
      .map((e: any) => e.text)
      .join('');
    expect(proseText).toBe('hello ');
  });
});
