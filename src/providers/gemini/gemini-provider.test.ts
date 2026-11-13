import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiProvider } from '@/providers/gemini/gemini-provider';

function okResponse(body: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ ok: true, configured: true, message: 'Đã kết nối.', ...body }),
  } as unknown as Response;
}

describe('GeminiProvider API key forwarding', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the user key only to a same-origin proxy endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GeminiProvider('/api/ai', 'gemini-2.5-flash', undefined, 'AIzaTestKey1234567890');
    const status = await provider.testConnection();

    expect(status.ok).toBe(true);
    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers['x-gemini-key']).toBe('AIzaTestKey1234567890');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('does not send a key when none was entered', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GeminiProvider('/api/ai', 'gemini-2.5-flash');
    await provider.testConnection();

    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers['x-gemini-key']).toBeUndefined();
  });

  it('never forwards a user key to an absolute third-party endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GeminiProvider(
      'https://example.com/ai',
      'gemini-2.5-flash',
      undefined,
      'AIzaTestKey1234567890',
    );
    await provider.testConnection();

    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers['x-gemini-key']).toBeUndefined();
  });
});
