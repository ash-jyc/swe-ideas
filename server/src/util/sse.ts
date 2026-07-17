import type { Response } from 'express';

/** Prepare an Express response for server-sent events. */
export function initSse(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Disable proxy buffering (nginx / render) so events flush immediately.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  // Initial comment kicks the stream open.
  res.write(': open\n\n');
}

export function sseSend(res: Response, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function sseComment(res: Response, text: string): void {
  res.write(`: ${text}\n\n`);
}
