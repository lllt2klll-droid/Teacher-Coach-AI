import { useSyncExternalStore } from 'react';
import { GEMINI_KEY_STORAGE_KEY, normalizeGeminiKey } from '@/lib/gemini-key';

let key = '';
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    if (typeof sessionStorage !== 'undefined') {
      key = normalizeGeminiKey(sessionStorage.getItem(GEMINI_KEY_STORAGE_KEY) ?? '');
    }
  } catch {
    // Private mode or blocked storage: keep the in-memory key only.
    key = '';
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function getGeminiApiKey(): string {
  hydrate();
  return key;
}

export function setGeminiApiKey(value: string): string {
  hydrate();
  key = normalizeGeminiKey(value);
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (key) sessionStorage.setItem(GEMINI_KEY_STORAGE_KEY, key);
      else sessionStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors; the key still works for this page view.
  }
  emit();
  return key;
}

export function clearGeminiApiKey(): void {
  setGeminiApiKey('');
}

function subscribe(listener: () => void): () => void {
  hydrate();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reactive key for components; returns '' when no key was entered. */
export function useGeminiApiKey(): string {
  return useSyncExternalStore(subscribe, getGeminiApiKey, getGeminiApiKey);
}
