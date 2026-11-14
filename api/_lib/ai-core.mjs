/**
 * Shared server-side AI proxy used by both the Vercel function (api/ai.js)
 * and the local development server (server/dev-ai-server.mjs).
 *
 * The Gemini API key only ever lives in server environment variables.
 * The browser never receives the key.
 */

const MAX_PAYLOAD_CHARS = 90_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

const buckets = new Map();

function rateLimit(key) {
  const now = Date.now();
  const entries = (buckets.get(key) || []).filter((stamp) => now - stamp < RATE_LIMIT_WINDOW_MS);
  if (entries.length >= RATE_LIMIT_MAX) {
    buckets.set(key, entries);
    return false;
  }
  entries.push(now);
  buckets.set(key, entries);
  if (buckets.size > 500) {
    for (const [bucketKey, stamps] of buckets.entries()) {
      const fresh = stamps.filter((stamp) => now - stamp < RATE_LIMIT_WINDOW_MS);
      if (!fresh.length) buckets.delete(bucketKey);
      else buckets.set(bucketKey, fresh);
    }
  }
  return true;
}

function json(status, body) {
  return { status, body };
}

function sanitizeError(message) {
  return String(message || 'Lỗi không xác định')
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[redacted-key]')
    .slice(0, 500);
}

function buildStudentPrompt(payload) {
  const lesson = payload?.lesson ?? {};
  const phase = payload?.phase ?? null;
  const student = payload?.student ?? {};
  const teacherText = String(payload?.teacherText ?? '').slice(0, 1200);
  const recentTurns = Array.isArray(payload?.recentTurns) ? payload.recentTurns.slice(-6) : [];
  const presentation = payload?.presentation && typeof payload.presentation === 'object' ? payload.presentation : null;
  const slideText = presentation ? String(presentation.text ?? '').slice(0, 1600) : '';
  const slideOutline = Array.isArray(presentation?.outline)
    ? presentation.outline.slice(0, 80).map((item) => String(item).slice(0, 160))
    : [];
  const schemaNote = `Chỉ trả về JSON đúng dạng: {"text": "...", "quality": "correct|partial|incorrect|neutral"}. Không thêm markdown.`;
  const system = [
    'Bạn là một học sinh tiểu học Việt Nam trong một lớp học mô phỏng để sinh viên sư phạm luyện tập.',
    'Bạn KHÔNG phải trợ lý AI. Bạn là nhân vật hư cấu, không nhận dạng trẻ em thật.',
    'Luôn tiếng Việt, xưng "em", gọi giáo viên là "cô" hoặc "thầy".',
    'Trả lời 1-3 câu ngắn, đúng trình độ lớp học và tính cách nhân vật.',
    'Không được bịa kiến thức ngoài bối cảnh bài học. Nếu chưa biết hoặc chưa được học, hãy nói "em chưa biết/chưa hiểu" thay vì trả lời bừa.',
    'Khi có baiTrinhChieu, slide hiện tại là nguồn đúng về những gì đang hiển thị. Nếu giáo viên hỏi tên đề/tiêu đề/nội dung đang chiếu hoặc bảo quan sát slide, phải dùng tieuDeSlide/noiDungSlide; không dùng tên kế hoạch bài dạy nếu khác.',
    'Không tự tạo nội dung slide hoặc nói rằng đã xem slide khác.',
    'Không mô tả cảm xúc khuôn mặt hay nhận xét ngoại hình; chỉ nói lời thoại.',
    schemaNote,
  ].join('\n');

  const context = {
    lop: lesson.grade ?? student.grade ?? 2,
    mon: lesson.subject ?? '',
    bai: lesson.title ?? '',
    chuDe: lesson.topic ?? '',
    mucTieu: Array.isArray(lesson.objectives) ? lesson.objectives.slice(0, 4) : [],
    kienThucTrongTam: Array.isArray(lesson.coreKnowledge) ? lesson.coreKnowledge.slice(0, 6) : [],
    hoatDong: phase
      ? {
          ten: phase.name,
          mucTieu: phase.objective,
          cauHoi: Array.isArray(phase.questions) ? phase.questions.slice(0, 5) : [],
          cauTraLoiDuKien: Array.isArray(phase.expectedResponses) ? phase.expectedResponses.slice(0, 5) : [],
        }
      : null,
    nhanVat: {
      ten: student.name,
      trinhDo: student.learningLevel,
      kieuThamGia: student.participationStyle,
      cachNoi: student.responseStyle,
      loiThuongGap: Array.isArray(student.misconceptionProfile) ? student.misconceptionProfile.slice(0, 3) : [],
    },
    loiGiaoVien: teacherText,
    hoiThoaiGanNhat: recentTurns,
    baiTrinhChieu: presentation
      ? {
          soSlide: Number(presentation.slideNumber) || null,
          tongSoSlide: Number(presentation.totalSlides) || null,
          tieuDeSlide: String(presentation.title ?? '').slice(0, 180),
          noiDungSlide: slideText,
          danhSachTieuDe: slideOutline,
        }
      : null,
    luuY: 'Nếu giáo viên đặt câu hỏi, hãy trả lời theo đúng hiểu biết của nhân vật. Không phải câu hỏi nào cũng trả lời đúng. Nếu có baiTrinhChieu, nội dung đang chiếu là nguồn ưu tiên khi câu hỏi liên quan đến slide/màn hình/tên đề; chỉ tham chiếu nội dung được cung cấp.',
  };
  return { system, prompt: JSON.stringify(context) };
}

function buildSummaryPrompt(payload) {
  const session = payload?.session ?? {};
  const metrics = payload?.metrics ?? {};
  const transcript = String(payload?.transcriptText ?? '').slice(0, 14000);
  const system = [
    'Bạn là trợ lý huấn luyện sư phạm cho sinh viên ngành Giáo dục Tiểu học Việt Nam.',
    'Chỉ nhận xét dựa trên dữ liệu được cung cấp. Không bịa sự kiện, không suy đoán cảm xúc hay ngoại hình.',
    'Giọng điệu hỗ trợ, không phán xét. Tiếng Việt.',
    'Chỉ trả về JSON: {"summary": "...", "strengths": ["..."], "improvements": ["..."]}. Mỗi mảng tối đa 4 mục, mỗi mục một câu.',
  ].join('\n');
  const prompt = JSON.stringify({
    baiDay: session.lessonTitle,
    thoiLuongGiay: session.durationSec,
    cheDo: session.mode,
    chiSo: metrics,
    transcript: transcript,
    luuY: 'Nếu dữ liệu quá ít, hãy nói rõ là chưa đủ dữ liệu thay vì kết luận mạnh.',
  });
  return { system, prompt };
}

async function callGemini({ apiKey, model, system, prompt, jsonSchema }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22_000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.75,
            topP: 0.9,
            maxOutputTokens: 600,
            responseMimeType: 'application/json',
            ...(jsonSchema ? { responseSchema: jsonSchema } : {}),
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
          ],
        }),
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || `Gemini trả về HTTP ${response.status}`;
      const status = response.status === 429 ? 429 : response.status >= 500 ? 502 : 400;
      throw Object.assign(new Error(message), { status });
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('') ?? '';
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) throw Object.assign(new Error(`Nội dung bị chặn bởi bộ lọc an toàn (${blockReason}).`), { status: 422 });
    if (!text.trim()) throw Object.assign(new Error('Gemini không trả về nội dung.'), { status: 502 });
    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

function extractJson(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Phản hồi AI không phải JSON.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

const STUDENT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    text: { type: 'STRING' },
    quality: { type: 'STRING', enum: ['correct', 'partial', 'incorrect', 'neutral'] },
  },
  required: ['text', 'quality'],
};

const SUMMARY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    strengths: { type: 'ARRAY', items: { type: 'STRING' } },
    improvements: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['summary', 'strengths', 'improvements'],
};

export function getAiConfig(env = process.env) {
  return {
    configured: Boolean(env.GEMINI_API_KEY),
    model: env.GEMINI_MODEL || 'gemini-2.5-flash',
  };
}

export async function handleAiRequest({
  action,
  payload,
  model,
  clientId = 'anonymous',
  apiKey = '',
  env = process.env,
}) {
  if (!rateLimit(clientId)) {
    return json(429, { ok: false, error: 'Bạn gọi AI quá nhanh. Hãy chờ một phút rồi thử lại.' });
  }
  const serverConfig = getAiConfig(env);
  const clientKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  const effectiveKey = clientKey || env.GEMINI_API_KEY || '';
  const keySource = clientKey ? 'client' : env.GEMINI_API_KEY ? 'server' : 'none';
  const config = { configured: Boolean(effectiveKey), model: serverConfig.model, source: keySource };
  const keyHint =
    keySource === 'client'
      ? ' Kiểm tra lại khóa nhập trong Cài đặt → AI.'
      : ' Kiểm tra biến môi trường GEMINI_API_KEY trên server.';

  if (action === 'status' || action === 'test') {
    if (!config.configured) {
      return json(200, {
        ok: false,
        configured: false,
        source: 'none',
        model: config.model,
        message:
          'Chưa có khóa Gemini. Nhập khóa trong Cài đặt → AI (chỉ lưu trong tab này) hoặc đặt GEMINI_API_KEY trên server.',
      });
    }
    if (action === 'status') {
      return json(200, {
        ok: true,
        configured: true,
        source: keySource,
        model: config.model,
        message:
          keySource === 'client'
            ? 'Đã cấu hình Gemini bằng khóa nhập trong Cài đặt.'
            : 'Đã cấu hình Gemini trên server.',
      });
    }
    try {
      const text = await callGemini({
        apiKey: effectiveKey,
        model: String(model || config.model),
        system: 'Bạn là trợ lý kiểm tra kết nối. Chỉ trả về JSON.',
        prompt: 'Trả về đúng JSON: {"ok": true}',
        jsonSchema: {
          type: 'OBJECT',
          properties: { ok: { type: 'BOOLEAN' } },
          required: ['ok'],
        },
      });
      const parsed = extractJson(text);
      return json(200, {
        ok: Boolean(parsed.ok),
        configured: true,
        source: keySource,
        model: String(model || config.model),
        message: 'Kết nối Gemini thành công. Phản hồi hợp lệ.',
      });
    } catch (error) {
      return json(error.status || 502, {
        ok: false,
        configured: true,
        source: keySource,
        model: String(model || config.model),
        error: sanitizeError(error.message),
        message: `Không kết nối được Gemini: ${sanitizeError(error.message).replace(/[.!?…]+$/, '')}.${keyHint}`,
      });
    }
  }

  if (!config.configured) {
    return json(503, {
      ok: false,
      configured: false,
      source: 'none',
      error:
        'Chưa có khóa Gemini. Nhập khóa trong Cài đặt → AI hoặc đặt GEMINI_API_KEY trên server.',
    });
  }
  if (JSON.stringify(payload ?? {}).length > MAX_PAYLOAD_CHARS) {
    return json(413, { ok: false, error: 'Dữ liệu gửi tới AI quá lớn. Chỉ gửi ngữ cảnh rút gọn.' });
  }

  const chosenModel = String(model || config.model).replace(/[^a-zA-Z0-9._-]/g, '') || config.model;

  try {
    if (action === 'student.respond') {
      const { system, prompt } = buildStudentPrompt(payload);
      const text = await callGemini({
        apiKey: effectiveKey,
        model: chosenModel,
        system,
        prompt,
        jsonSchema: STUDENT_SCHEMA,
      });
      const parsed = extractJson(text);
      const responseText = String(parsed.text ?? '').trim().slice(0, 500);
      const quality = ['correct', 'partial', 'incorrect', 'neutral'].includes(parsed.quality) ? parsed.quality : 'neutral';
      if (!responseText) throw new Error('AI trả về lời thoại rỗng.');
      return json(200, { ok: true, data: { text: responseText, quality, source: 'gemini' }, model: chosenModel });
    }

    if (action === 'session.summarize') {
      const { system, prompt } = buildSummaryPrompt(payload);
      const text = await callGemini({
        apiKey: effectiveKey,
        model: chosenModel,
        system,
        prompt,
        jsonSchema: SUMMARY_SCHEMA,
      });
      const parsed = extractJson(text);
      return json(200, {
        ok: true,
        data: {
          summary: String(parsed.summary ?? '').slice(0, 1200),
          strengths: (Array.isArray(parsed.strengths) ? parsed.strengths : []).slice(0, 4).map((item) => String(item).slice(0, 240)),
          improvements: (Array.isArray(parsed.improvements) ? parsed.improvements : []).slice(0, 4).map((item) => String(item).slice(0, 240)),
        },
        model: chosenModel,
      });
    }

    return json(400, { ok: false, error: `Hành động “${action}” không được hỗ trợ.` });
  } catch (error) {
    const status = error.status || 502;
    return json(status, {
      ok: false,
      configured: true,
      source: keySource,
      error: sanitizeError(error.message),
      message:
        status === 429
          ? 'Gemini đã hết hạn mức hoặc bị giới hạn tần suất. Ứng dụng sẽ tạm dùng chế độ cục bộ.'
          : `Lỗi AI: ${sanitizeError(error.message).replace(/[.!?…]+$/, '')}.${keyHint}`,
    });
  }
}
