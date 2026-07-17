import type { LlmAdapter, LlmChunk, LlmRequest } from './types.js';
import { LlmError } from './types.js';
import { sseData } from './stream.js';

const DEFAULT_BASE = 'https://api.openai.com/v1';

/**
 * OpenAI chat.completions streaming adapter. Reused by the openai-compatible
 * adapter with a custom base URL (Together, Groq, Ollama, vLLM, etc.).
 */
export async function* streamOpenAiCompatible(
  req: LlmRequest,
  fallbackBase: string,
): AsyncGenerator<LlmChunk> {
  const base = (req.baseUrl || fallbackBase).replace(/\/$/, '');
  const messages = [
    { role: 'system', content: req.system },
    ...req.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal: req.signal,
    headers: {
      'content-type': 'application/json',
      ...(req.apiKey ? { authorization: `Bearer ${req.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: req.model,
      stream: true,
      stream_options: { include_usage: true },
      messages,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new LlmError(`OpenAI error ${res.status}: ${text.slice(0, 500)}`);
  }

  let usageEmitted = false;
  for await (const data of sseData(res.body)) {
    if (data === '[DONE]') break;
    let evt: any;
    try {
      evt = JSON.parse(data);
    } catch {
      continue;
    }
    const delta = evt.choices?.[0]?.delta?.content;
    if (delta) yield { type: 'text', text: delta };
    if (evt.usage) {
      usageEmitted = true;
      yield {
        type: 'usage',
        usage: {
          promptTokens: evt.usage.prompt_tokens,
          completionTokens: evt.usage.completion_tokens,
          totalTokens: evt.usage.total_tokens,
        },
      };
    }
  }
  if (!usageEmitted) {
    // Some compatible servers omit usage; leave counts undefined.
  }
}

export const openaiAdapter: LlmAdapter = {
  id: 'openai',
  stream(req: LlmRequest) {
    if (!req.apiKey) throw new LlmError('OpenAI API key required');
    return streamOpenAiCompatible(req, DEFAULT_BASE);
  },
};
