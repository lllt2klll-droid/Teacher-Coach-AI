import { describe, expect, it } from 'vitest';
import { looksLikeGeminiKey, maskGeminiKey, normalizeGeminiKey } from '@/lib/gemini-key';

describe('gemini key helpers', () => {
  it('removes whitespace and surrounding quotes from a pasted key', () => {
    expect(normalizeGeminiKey('  "AIzaSyExampleKey1234567890"  ')).toBe('AIzaSyExampleKey1234567890');
    expect(normalizeGeminiKey('AIzaSy Example\nKey1234567890')).toBe('AIzaSyExampleKey1234567890');
  });

  it('accepts the usual Google AI Studio format and rejects empty values', () => {
    expect(looksLikeGeminiKey('AIzaSyExampleKey1234567890')).toBe(true);
    expect(looksLikeGeminiKey('')).toBe(false);
    expect(looksLikeGeminiKey('sk-not-a-google-key')).toBe(false);
  });

  it('masks the key without exposing the middle', () => {
    const masked = maskGeminiKey('AIzaSyExampleKey1234567890');
    expect(masked).toBe('AIza…7890');
    expect(masked).not.toContain('ExampleKey');
  });
});
