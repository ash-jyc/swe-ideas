import httpProxy from 'http-proxy';
import type { Request, Response, RequestHandler } from 'express';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { appManager, previewId, siteId } from './manager.js';
import { ensurePreviewRunning, ensureSiteRunning } from './service.js';

const proxy = httpProxy.createProxyServer({ ws: true, xfwd: true });

proxy.on('error', (_err, _req, res) => {
  const r = res as Response;
  if (r && 'writeHead' in r && !r.headersSent) {
    r.writeHead(502, { 'content-type': 'text/html' });
    r.end(errorPage('The app is not responding. It may have crashed — check the run logs.'));
  }
});

// Inject <base> into HTML so relative asset/fetch URLs resolve under the prefix,
// as a safety net on top of the codegen convention.
proxy.on('proxyRes', (proxyRes, req, res) => {
  const prefix = (req as any)._vibePrefix as string | undefined;
  const ct = String(proxyRes.headers['content-type'] || '');
  const r = res as Response;
  if (prefix && ct.includes('text/html') && !proxyRes.headers['content-encoding']) {
    const chunks: Buffer[] = [];
    proxyRes.on('data', (c: Buffer) => chunks.push(c));
    proxyRes.on('end', () => {
      const body = injectBase(Buffer.concat(chunks).toString('utf8'), prefix);
      const headers = { ...proxyRes.headers };
      delete headers['content-length'];
      r.writeHead(proxyRes.statusCode || 200, headers);
      r.end(body);
    });
  } else {
    r.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(r);
  }
});

function injectBase(html: string, prefix: string): string {
  if (/<base\s/i.test(html)) return html;
  const tag = `<base href="${prefix}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n  ${tag}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${tag}</head>`);
  }
  return `${tag}\n${html}`;
}

export function errorPage(message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:system-ui,sans-serif;background:#0f1117;color:#e6e8ef;display:grid;place-items:center;height:100vh;margin:0}
    .box{max-width:420px;text-align:center;padding:24px}
    h2{font-weight:600;margin:0 0 8px}
    p{color:#8b93a7}
  </style></head><body><div class="box"><h2>Preview unavailable</h2><p>${message}</p></div></body></html>`;
}

/** Express handler for /run/:projectId/* — the live preview proxy. */
export const runProxyMiddleware: RequestHandler = async (req: Request, res: Response) => {
  const projectId = req.params.projectId!;
  // Redirect the bare prefix to a trailing slash so relative URLs resolve.
  if (req.originalUrl === `/run/${projectId}`) {
    res.redirect(302, `/run/${projectId}/`);
    return;
  }
  let inst;
  try {
    inst = await ensurePreviewRunning(projectId);
  } catch {
    res.status(500).send(errorPage('Failed to start the preview.'));
    return;
  }
  if (inst.state !== 'running' || inst.port == null) {
    res.status(503).send(errorPage(inst.message || 'The preview is not running yet.'));
    return;
  }
  appManager.touch(previewId(projectId));
  (req as any)._vibePrefix = `/run/${projectId}/`;
  proxy.web(req, res, { target: `http://127.0.0.1:${inst.port}`, selfHandleResponse: true });
};

/** Express handler for /sites/:slug/* — the deployed-site proxy. */
export const siteProxyMiddleware: RequestHandler = async (req: Request, res: Response) => {
  const slug = req.params.slug!;
  if (req.originalUrl === `/sites/${slug}`) {
    res.redirect(302, `/sites/${slug}/`);
    return;
  }
  const inst = await ensureSiteRunning(slug);
  if (!inst) {
    res.status(404).send(errorPage('No deployment found at this address.'));
    return;
  }
  if (inst.state !== 'running' || inst.port == null) {
    res.status(503).send(errorPage(inst.message || 'The site is starting up.'));
    return;
  }
  appManager.touch(siteId(slug));
  (req as any)._vibePrefix = `/sites/${slug}/`;
  proxy.web(req, res, { target: `http://127.0.0.1:${inst.port}`, selfHandleResponse: true });
};

/** WebSocket upgrade pass-through for preview and deployed apps. */
export async function handleUpgrade(
  req: IncomingMessage,
  socket: Socket,
  head: Buffer,
): Promise<void> {
  const url = req.url || '';
  let match = /^\/run\/([^/]+)/.exec(url);
  if (match) {
    const inst = await ensurePreviewRunning(match[1]!).catch(() => null);
    if (inst?.port) {
      proxy.ws(req, socket, head, { target: `http://127.0.0.1:${inst.port}` });
    } else {
      socket.destroy();
    }
    return;
  }
  match = /^\/sites\/([^/]+)/.exec(url);
  if (match) {
    const inst = await ensureSiteRunning(match[1]!);
    if (inst?.port) {
      proxy.ws(req, socket, head, { target: `http://127.0.0.1:${inst.port}` });
    } else {
      socket.destroy();
    }
    return;
  }
  socket.destroy();
}
