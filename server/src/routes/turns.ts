import { Router } from 'express';
import type {
  GenerateRequest,
  GenerateEvent,
  TurnDetail,
  TurnDiffResponse,
} from '@vibe/shared';
import { getProject, touchProject } from '../db/repositories/projects.js';
import {
  nextSeq,
  createTurn,
  completeTurn,
  failTurn,
  listTurns,
  getTurn,
  getFileOps,
  getSnapshot,
} from '../db/repositories/turns.js';
import { buildContext } from '../codegen/contextBuilder.js';
import { PROMPT_VERSION } from '../codegen/systemPrompt.js';
import { parseResponse, StreamingParser } from '../codegen/parser.js';
import { applyOps } from '../codegen/applyOps.js';
import { getAdapter } from '../llm/registry.js';
import { restartPreview } from '../runner/service.js';
import { initSse, sseSend } from '../util/sse.js';
import { getParam } from '../util/params.js';
import type { TokenUsage } from '@vibe/shared';

export const turnsRouter = Router({ mergeParams: true });

// POST /api/projects/:id/generate  (SSE)
turnsRouter.post('/generate', async (req, res) => {
  const projectId = getParam(req, 'id');
  const project = getProject(projectId);
  if (!project) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const body = req.body as GenerateRequest;
  const prompt = body?.prompt?.trim();
  const creds = body?.credentials;
  if (!prompt || !creds?.provider || !creds?.model) {
    res.status(400).json({ error: 'prompt and credentials {provider, model} are required' });
    return;
  }

  const seq = nextSeq(projectId);
  const turn = createTurn({
    projectId,
    seq,
    prompt,
    provider: creds.provider,
    model: creds.model,
    baseUrl: creds.baseUrl ?? null,
    promptVersion: PROMPT_VERSION,
  });

  initSse(res);
  const send = (e: GenerateEvent) => sseSend(res, e);
  send({ type: 'turn-start', turnId: turn.id, seq });

  const abort = new AbortController();
  // Detect a genuine client disconnect via the response, not the request —
  // `req` "close" fires as soon as the POST body is fully read.
  res.on('close', () => {
    if (!res.writableEnded) abort.abort();
  });

  const parser = new StreamingParser();
  let raw = '';
  let usage: TokenUsage = {};

  try {
    const adapter = getAdapter(creds);
    const context = buildContext(projectId, prompt);

    for await (const chunk of adapter.stream({
      system: context.system,
      messages: context.messages,
      model: creds.model,
      apiKey: creds.apiKey,
      baseUrl: creds.baseUrl,
      signal: abort.signal,
    })) {
      if (chunk.type === 'usage') {
        usage = chunk.usage;
        send({ type: 'usage', usage });
        continue;
      }
      raw += chunk.text;
      for (const ev of parser.feed(chunk.text)) {
        if (ev.type === 'prose') send({ type: 'token', text: ev.text });
        else if (ev.type === 'file-open') send({ type: 'file-open', path: ev.path });
        else if (ev.type === 'file-close') send({ type: 'file-op', op: 'write', path: ev.path });
        else if (ev.type === 'delete') send({ type: 'file-op', op: 'delete', path: ev.path });
      }
    }
    for (const ev of parser.end()) {
      if (ev.type === 'prose') send({ type: 'token', text: ev.text });
    }

    // Authoritative parse + persist.
    const parsed = parseResponse(raw);
    completeTurn({ turnId: turn.id, rawResponse: raw, summary: parsed.summary, usage });
    applyOps(projectId, turn.id, parsed.ops);
    touchProject(projectId);

    // Restart the preview with the new files (best-effort, don't block done).
    send({ type: 'run-status', state: 'starting' });
    restartPreview(projectId)
      .then((inst) => {
        send({ type: 'run-status', state: inst.state, message: inst.message ?? undefined });
        send({ type: 'done', turnId: turn.id, fileCount: parsed.ops.length });
        res.end();
      })
      .catch(() => {
        send({ type: 'done', turnId: turn.id, fileCount: parsed.ops.length });
        res.end();
      });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    failTurn(turn.id, raw, message);
    send({ type: 'error', message });
    res.end();
  }
});

turnsRouter.get('/turns', (req, res) => {
  const projectId = getParam(req, 'id');
  // Omit heavy blobs from the list view.
  const turns = listTurns(projectId).map((t) => ({ ...t, rawResponse: '' }));
  res.json(turns);
});

turnsRouter.get('/turns/:turnId', (req, res) => {
  const turn = getTurn(req.params.turnId);
  if (!turn || turn.projectId !== getParam(req, 'id')) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const detail: TurnDetail = { ...turn, ops: getFileOps(turn.id) };
  res.json(detail);
});

turnsRouter.get('/turns/:turnId/diff', (req, res) => {
  const turn = getTurn(req.params.turnId);
  if (!turn || turn.projectId !== getParam(req, 'id')) {
    res.status(404).json({ error: 'not found' });
    return;
  }

  // "before" state = the file set snapshotted at the previous complete turn.
  const prior = listTurns(turn.projectId).filter(
    (t) => t.status === 'complete' && t.seq < turn.seq,
  );
  const prevTurn = prior.length ? prior[prior.length - 1] : null;
  const beforeMap = new Map<string, string>();
  if (prevTurn) {
    for (const f of getSnapshot(prevTurn.id)) beforeMap.set(f.path, f.content);
  }

  const ops = getFileOps(turn.id);
  const response: TurnDiffResponse = {
    files: ops.map((o) => ({
      path: o.path,
      op: o.op,
      unifiedDiff: o.unifiedDiff ?? '',
      before: beforeMap.get(o.path) ?? '',
      after: o.op === 'delete' ? '' : o.contentAfter ?? '',
    })),
  };
  res.json(response);
});
