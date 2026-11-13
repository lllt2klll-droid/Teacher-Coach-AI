import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

/**
 * Runs the same server-side Gemini proxy as Vercel (`api/ai.js`) inside the
 * Vite dev server. `npm run dev` therefore supports the optional browser
 * key or a server-side GEMINI_API_KEY without a second terminal.
 */
function localAiProxy(): Plugin {
  return {
    name: 'teacher-coach-ai-local-proxy',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      if (!process.env.GEMINI_API_KEY && env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
      if (!process.env.GEMINI_MODEL && env.GEMINI_MODEL) process.env.GEMINI_MODEL = env.GEMINI_MODEL;

      server.middlewares.use('/api/ai', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: 'Chỉ hỗ trợ POST.' }));
          return;
        }

        let raw = '';
        let tooLarge = false;
        req.on('data', (chunk: Buffer) => {
          if (tooLarge) return;
          raw += chunk.toString('utf8');
          if (raw.length > 200_000) {
            tooLarge = true;
            raw = '';
          }
        });
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          if (tooLarge) {
            res.statusCode = 413;
            res.end(JSON.stringify({ ok: false, error: 'Payload quá lớn.' }));
            return;
          }
          try {
            const body = JSON.parse(raw || '{}') as {
              action?: unknown;
              payload?: unknown;
              model?: unknown;
            };
            const headerKey = req.headers['x-gemini-key'];
            const apiKey = Array.isArray(headerKey) ? headerKey[0] : headerKey;
            const { handleAiRequest } = await import('./api/_lib/ai-core.mjs');
            const result = await handleAiRequest({
              action: String(body.action || ''),
              payload: body.payload,
              model: typeof body.model === 'string' ? body.model : undefined,
              apiKey: typeof apiKey === 'string' ? apiKey.slice(0, 200) : undefined,
              clientId: req.socket.remoteAddress || 'local-dev',
            });
            res.statusCode = result.status;
            res.end(JSON.stringify(result.body));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: 'JSON không hợp lệ hoặc lỗi server AI.' }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localAiProxy()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_AI_DEV_ORIGIN || 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@mediapipe/tasks-vision')) return 'mediapipe';
          if (id.includes('pdfjs-dist')) return 'pdf';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
