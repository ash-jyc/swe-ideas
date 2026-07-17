import type { LlmAdapter, LlmChunk, LlmRequest } from './types.js';
import { LlmError } from './types.js';
import { sseData } from './stream.js';

const DEFAULT_BASE = 'https://api.anthropic.com';

export const anthropicAdapter: LlmAdapter = {
  id: 'anthropic',
  async *stream(req: LlmRequest): AsyncGenerator<LlmChunk> {
    if (!req.apiKey) throw new LlmError('Anthropic API key required');
    const base = (req.baseUrl || DEFAULT_BASE).replace(/\/$/, '');
    const res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      signal: req.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': req.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: req.model,
        max_tokens: 8192,
        stream: true,
        system: req.system,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new LlmError(`Anthropic error ${res.status}: ${text.slice(0, 500)}`);
    }

    let promptTokens: number | undefined;
    let completionTokens: number | undefined;

    for await (const data of sseData(res.body)) {
      if (data === '[DONE]') break;
      let evt: any;
      try {
        evt = JSON.parse(data);
      } catch {
        continue;
      }
      switch (evt.type) {
        case 'message_start':
          promptTokens = evt.message?.usage?.input_tokens ?? promptTokens;
          break;
        case 'content_block_delta':
          if (evt.delta?.type === 'text_delta' && evt.delta.text) {
            yield { type: 'text', text: evt.delta.text };
          }
          break;
        case 'message_delta':
          if (evt.usage?.output_tokens != null) {
            completionTokens = evt.usage.output_tokens;
          }
          break;
        case 'error':
          throw new LlmError(evt.error?.message || 'Anthropic stream error');
      }
    }

    if (promptTokens != null || completionTokens != null) {
      yield {
        type: 'usage',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens:
            promptTokens != null && completionTokens != null
              ? promptTokens + completionTokens
              : undefined,
        },
      };
    }
  },
};
