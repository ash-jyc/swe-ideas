import type { LlmAdapter, LlmRequest } from './types.js';
import { LlmError } from './types.js';
import { streamOpenAiCompatible } from './openai.js';

/** Any OpenAI-compatible endpoint via a user-supplied base URL. */
export const openaiCompatibleAdapter: LlmAdapter = {
  id: 'openai-compatible',
  stream(req: LlmRequest) {
    if (!req.baseUrl) {
      throw new LlmError('A base URL is required for an OpenAI-compatible provider');
    }
    return streamOpenAiCompatible(req, req.baseUrl);
  },
};
