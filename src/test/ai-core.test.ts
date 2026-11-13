import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleAiRequest } from '../../api/_lib/ai-core.mjs';

const SERVER_KEY = 'AIzaServerKeyForTest1234567890';
const CLIENT_KEY = 'AIzaClientKeyForTest1234567890';

describe('handleAiRequest key resolution', () => {
  it('reports no key when neither client nor server has one', async () => {
    const result = await handleAiRequest({
      action: 'status',
      clientId: 'test-none',
      env: {},
    });

    expect(result.status).toBe(200);
    expect(result.body.configured).toBe(false);
    expect(result.body.source).toBe('none');
    expect(String(result.body.message)).toContain('Cài đặt');
  });

  it('uses the server env key when the client sends none', async () => {
    const result = await handleAiRequest({
      action: 'status',
      clientId: 'test-server',
      env: { GEMINI_API_KEY: SERVER_KEY },
    });

    expect(result.body.configured).toBe(true);
    expect(result.body.source).toBe('server');
    expect(JSON.stringify(result.body)).not.toContain(SERVER_KEY);
  });

  it('prefers the client key and never echoes it back', async () => {
    const result = await handleAiRequest({
      action: 'status',
      clientId: 'test-client',
      apiKey: CLIENT_KEY,
      env: { GEMINI_API_KEY: SERVER_KEY },
    });

    expect(result.body.configured).toBe(true);
    expect(result.body.source).toBe('client');
    expect(String(result.body.message)).toContain('Cài đặt');
    expect(JSON.stringify(result.body)).not.toContain(CLIENT_KEY);
    expect(JSON.stringify(result.body)).not.toContain(SERVER_KEY);
  });
});

describe('handleAiRequest student slide context', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the current slide text and compact outline to Gemini', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"text":"Dạ, em đang xem slide ạ.","quality":"neutral"}' }],
            },
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await handleAiRequest({
      action: 'student.respond',
      clientId: `test-slide-${Date.now()}`,
      apiKey: CLIENT_KEY,
      env: {},
      payload: {
        lesson: { title: 'Bảng nhân 4', grade: 2, subject: 'Toán', topic: 'Bảng nhân 4' },
        phase: null,
        student: { name: 'Minh Anh', participationStyle: 'active', learningLevel: 'advanced' },
        teacherText: 'Các em nhìn lên slide nhé.',
        recentTurns: [],
        presentation: {
          slideNumber: 2,
          totalSlides: 5,
          title: 'Quy tắc bảng nhân 4',
          text: 'Lấy thừa số nhân với nhau.',
          outline: ['1. Khởi động', '2. Quy tắc bảng nhân 4'],
        },
      },
    });

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const requestBody = JSON.parse(String(init.body)) as {
      systemInstruction: { parts: Array<{ text: string }> };
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    const prompt = requestBody.contents[0].parts[0].text;
    const system = requestBody.systemInstruction.parts[0].text;

    expect(prompt).toContain('baiTrinhChieu');
    expect(prompt).toContain('Quy tắc bảng nhân 4');
    expect(prompt).toContain('Lấy thừa số nhân với nhau.');
    expect(prompt).toContain('2. Quy tắc bảng nhân 4');
    expect(system).toContain('baiTrinhChieu');
  });
});
