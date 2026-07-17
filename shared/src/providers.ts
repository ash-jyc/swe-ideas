// BYOK provider definitions shared by the platform UI and server.
// Credentials are supplied by the user, stored client-side, and passed
// per-request. They are NEVER persisted server-side.

export type ProviderId = 'anthropic' | 'openai' | 'openai-compatible' | 'mock';

export interface ByokCredentials {
  provider: ProviderId;
  model: string;
  /** API key. Omitted / ignored for the `mock` provider. */
  apiKey?: string;
  /** Base URL, required for `openai-compatible`, optional override otherwise. */
  baseUrl?: string;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ModelPreset {
  id: string;
  label: string;
}

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  /** Whether this provider needs an API key. */
  needsKey: boolean;
  /** Whether this provider needs a base URL entered by the user. */
  needsBaseUrl: boolean;
  /** Default base URL if the provider has a fixed one. */
  defaultBaseUrl?: string;
  /** A few suggested models; the user may type any model id. */
  models: ModelPreset[];
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    needsKey: true,
    needsBaseUrl: false,
    defaultBaseUrl: 'https://api.anthropic.com',
    models: [
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { id: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    needsKey: true,
    needsBaseUrl: false,
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'o4-mini', label: 'o4-mini' },
    ],
  },
  {
    id: 'openai-compatible',
    label: 'OpenAI-compatible',
    needsKey: true,
    needsBaseUrl: true,
    models: [
      { id: 'llama-3.3-70b', label: 'Llama 3.3 70B (example)' },
    ],
  },
  {
    id: 'mock',
    label: 'Mock (no API key)',
    needsKey: false,
    needsBaseUrl: false,
    models: [
      { id: 'mock-todo-app', label: 'Scripted: todo app' },
      { id: 'mock-vulnerable', label: 'Scripted: vulnerable notes app' },
    ],
  },
];
