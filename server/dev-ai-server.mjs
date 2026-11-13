import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { handleAiRequest } from '../api/_lib/ai-core.mjs';

const PORT = Number(process.env.AI_DEV_PORT || 8787);

function loadEnvFile(fileName) {
  const path = resolve(process.cwd(), fileName);
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-key');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Chỉ hỗ trợ POST.' }));
    return;
  }
  if (req.url !== '/api/ai' && req.url !== '/ai') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Không tìm thấy endpoint.' }));
    return;
  }
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 200_000) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Payload quá lớn.' }));
      req.destroy();
    }
  });
  req.on('end', async () => {
    try {
      const body = JSON.parse(raw || '{}');
      const headerKey = req.headers['x-gemini-key'];
      const apiKey = Array.isArray(headerKey) ? headerKey[0] : headerKey;
      const result = await handleAiRequest({
        action: String(body.action || ''),
        payload: body.payload,
        model: typeof body.model === 'string' ? body.model : undefined,
        apiKey: typeof apiKey === 'string' ? apiKey.slice(0, 200) : undefined,
        clientId: req.socket.remoteAddress || 'local',
      });
      res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result.body));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'JSON không hợp lệ hoặc lỗi server.' }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[Teacher Coach AI] AI dev proxy listening on http://localhost:${PORT}/api/ai`);
  if (!process.env.GEMINI_API_KEY) {
    console.log('[Teacher Coach AI] GEMINI_API_KEY chưa có — ứng dụng sẽ dùng chế độ cục bộ.');
  } else {
    console.log(`[Teacher Coach AI] Gemini đã cấu hình. Model mặc định: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}`);
  }
});
