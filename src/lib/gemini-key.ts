/**
 * Gemini API key helpers (bring-your-own-key mode).
 *
 * The key is user-supplied and optional. It is never written to IndexedDB,
 * never included in backups and never persisted in localStorage. The store
 * keeps it in sessionStorage so a reload in the same tab still works, but
 * closing the tab forgets it.
 */

export const GEMINI_KEY_STORAGE_KEY = 'teacher-coach-gemini-key';

export function normalizeGeminiKey(value: string): string {
  return String(value ?? '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\s+/g, '');
}

/**
 * Google AI Studio keys currently start with "AIza" followed by a long
 * token. The check is intentionally soft: if Google changes the format the
 * app still lets the teacher try the key and reports the real server error.
 */
export function looksLikeGeminiKey(value: string): boolean {
  const key = normalizeGeminiKey(value);
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(key);
}

export function maskGeminiKey(value: string): string {
  const key = normalizeGeminiKey(value);
  if (!key) return '';
  if (key.length <= 10) return '••••••';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
