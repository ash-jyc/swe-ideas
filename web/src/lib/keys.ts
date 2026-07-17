import { useSyncExternalStore } from 'react';
import type { ByokCredentials } from '@vibe/shared';

// BYOK credentials live ONLY in the browser (localStorage) and are sent per
// request. They are never persisted server-side.

const STORAGE_KEY = 'vibe.byok.v1';
const listeners = new Set<() => void>();

// useSyncExternalStore requires a STABLE snapshot: getSnapshot must return the
// same reference until the underlying value actually changes. We cache the
// parsed object keyed by the raw string so we don't return a new object each
// render (which would loop forever — React error #185).
let cache: { raw: string | null; parsed: ByokCredentials | null } = {
  raw: null,
  parsed: null,
};

export function loadCreds(): ByokCredentials | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cache.raw) {
    cache = { raw, parsed: raw ? (JSON.parse(raw) as ByokCredentials) : null };
  }
  return cache.parsed;
}

export function saveCreds(creds: ByokCredentials): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  listeners.forEach((l) => l());
}

export function clearCreds(): void {
  localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** React hook exposing the current credentials, reactive to changes. */
export function useCredentials(): ByokCredentials | null {
  return useSyncExternalStore(subscribe, loadCreds, () => null);
}

/** Whether we have enough to make a request (mock needs no key). */
export function credsReady(creds: ByokCredentials | null): boolean {
  if (!creds || !creds.model) return false;
  if (creds.provider === 'mock') return true;
  if (creds.provider === 'openai-compatible') return !!creds.baseUrl && !!creds.apiKey;
  return !!creds.apiKey;
}
