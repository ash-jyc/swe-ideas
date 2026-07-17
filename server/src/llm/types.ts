import type { ProviderId, TokenUsage } from '@vibe/shared';
import type { ChatMessage } from '../codegen/contextBuilder.js';

export type LlmChunk =
  | { type: 'text'; text: string }
  | { type: 'usage'; usage: TokenUsage };

export interface LlmRequest {
  system: string;
  messages: ChatMessage[];
  model: string;
  apiKey?: string;
  baseUrl?: string;
  signal?: AbortSignal;
}

export interface LlmAdapter {
  readonly id: ProviderId;
  stream(req: LlmRequest): AsyncIterable<LlmChunk>;
}

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmError';
  }
}
