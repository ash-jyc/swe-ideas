import type { ByokCredentials } from '@vibe/shared';
import type { LlmAdapter } from './types.js';
import { LlmError } from './types.js';
import { anthropicAdapter } from './anthropic.js';
import { openaiAdapter } from './openai.js';
import { openaiCompatibleAdapter } from './openaiCompatible.js';
import { mockAdapter } from './mock.js';

const adapters: Record<string, LlmAdapter> = {
  anthropic: anthropicAdapter,
  openai: openaiAdapter,
  'openai-compatible': openaiCompatibleAdapter,
  mock: mockAdapter,
};

export function getAdapter(creds: ByokCredentials): LlmAdapter {
  const adapter = adapters[creds.provider];
  if (!adapter) throw new LlmError(`Unknown provider: ${creds.provider}`);
  return adapter;
}
