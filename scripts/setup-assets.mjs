#!/usr/bin/env node
/**
 * Ensures the local MediaPipe assets required by the pose analyser exist.
 *
 * Sources, in order:
 *   1. TAI_PHAN_MEM/models (local archive)
 *   2. Google's public MediaPipe model storage (downloaded into TAI_PHAN_MEM)
 *   3. node_modules/@mediapipe/tasks-vision/wasm (existing npm dependency)
 *
 * The public/ folder is generated output. Originals live in TAI_PHAN_MEM/.
 * Running this script is safe and idempotent.
 */
import { access, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const modelName = 'pose_landmarker_lite.task';
const modelUrl =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const wasmFiles = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_module_internal.js',
  'vision_wasm_module_internal.wasm',
];

const archiveModelDir = join(root, 'TAI_PHAN_MEM', 'models');
const archiveModelPath = join(archiveModelDir, modelName);
const publicModelDir = join(root, 'public', 'models');
const publicModelPath = join(publicModelDir, modelName);
const publicWasmDir = join(root, 'public', 'mediapipe', 'wasm');
const archiveWasmDir = join(root, 'TAI_PHAN_MEM', 'mediapipe', 'wasm');
const npmWasmDir = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function fileSize(path) {
  const info = await stat(path);
  return `${(info.size / 1024 / 1024).toFixed(1)} MB`;
}

async function download(url, destination) {
  console.log(`[assets] Đang tải ${url}`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status} khi tải ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`Tệp tải về rỗng: ${url}`);
  await writeFile(destination, bytes);
}

async function ensureModel() {
  await mkdir(archiveModelDir, { recursive: true });
  await mkdir(publicModelDir, { recursive: true });

  if (!(await exists(archiveModelPath))) {
    await download(modelUrl, archiveModelPath);
    console.log(`[assets] Đã lưu model vào TAI_PHAN_MEM/models (${await fileSize(archiveModelPath)}).`);
  }

  if (!(await exists(publicModelPath))) {
    await copyFile(archiveModelPath, publicModelPath);
    console.log(`[assets] Đã sao chép model sang public/models (${await fileSize(publicModelPath)}).`);
  } else {
    console.log(`[assets] Model đã có: public/models/${modelName} (${await fileSize(publicModelPath)}).`);
  }
}

async function ensureWasm() {
  await mkdir(publicWasmDir, { recursive: true });
  const pending = [];

  for (const file of wasmFiles) {
    const destination = join(publicWasmDir, file);
    if (await exists(destination)) {
      console.log(`[assets] WASM đã có: public/mediapipe/wasm/${file}`);
      continue;
    }
    const candidates = [join(archiveWasmDir, file), join(npmWasmDir, file)];
    let copied = false;
    for (const source of candidates) {
      if (!(await exists(source))) continue;
      await copyFile(source, destination);
      console.log(`[assets] Đã sao chép ${file} từ ${source.replace(root, '')}.`);
      copied = true;
      break;
    }
    if (!copied) pending.push(file);
  }

  if (pending.length) {
    throw new Error(
      `Thiếu tệp WASM: ${pending.join(', ')}. Hãy chạy "npm install" trước, hoặc tải @mediapipe/tasks-vision.`,
    );
  }
}

async function main() {
  try {
    await ensureModel();
    await ensureWasm();
    console.log('[assets] MediaPipe sẵn sàng. Ảnh/video vẫn được xử lý cục bộ trong trình duyệt.');
  } catch (error) {
    const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    console.error(`[assets] Không thể chuẩn bị tài nguyên cho ${packageJson.name}:`, error.message);
    process.exitCode = 1;
  }
}

await main();
