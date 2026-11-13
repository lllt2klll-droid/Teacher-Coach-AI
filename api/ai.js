import { handleAiRequest } from './_lib/ai-core.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Chỉ hỗ trợ POST.' });
    return;
  }
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ ok: false, error: 'Body không phải JSON hợp lệ.' });
      return;
    }
  }
  if (!body || typeof body !== 'object') {
    res.status(400).json({ ok: false, error: 'Thiếu dữ liệu yêu cầu.' });
    return;
  }
  const ip =
    (Array.isArray(req.headers['x-forwarded-for'])
      ? req.headers['x-forwarded-for'][0]
      : String(req.headers['x-forwarded-for'] || '').split(',')[0]) ||
    req.socket?.remoteAddress ||
    'unknown';
  const rawKey = req.headers['x-gemini-key'];
  const apiKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;
  const result = await handleAiRequest({
    action: String(body.action || ''),
    payload: body.payload,
    model: typeof body.model === 'string' ? body.model : undefined,
    apiKey: typeof apiKey === 'string' ? apiKey.slice(0, 200) : undefined,
    clientId: ip,
  });
  res.status(result.status).json(result.body);
}
