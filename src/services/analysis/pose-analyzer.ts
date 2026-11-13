import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';
import type { PoseKeypoint, PostureMetrics } from '@/types/domain';
import { average, clamp, round } from '@/lib/utils';

export type PoseStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unsupported';

export interface PoseFrame {
  timestamp: number;
  keypoints: PoseKeypoint[];
  metrics: PostureMetrics;
  confidence: number;
}

export interface PoseAnalyzerOptions {
  video: HTMLVideoElement;
  overlay?: HTMLCanvasElement | null;
  wasmPath?: string;
  modelPath?: string;
  targetFps?: number;
  onFrame?: (frame: PoseFrame) => void;
  onStatus?: (status: PoseStatus, message?: string) => void;
}

const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/models/pose_landmarker_lite.task';
const OVERLAY_SAMPLE_RATE = 8;

/** MediaPipe Pose landmark connections used for the skeleton overlay. */
const CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [28, 30],
  [29, 31],
  [30, 32],
  [27, 31],
  [28, 32],
];

const CORE_LANDMARKS = [0, 11, 12, 13, 14, 23, 24];
const WRISTS = [15, 16];
const SHOULDERS = [11, 12];

function toKeypoint(landmark: NormalizedLandmark): PoseKeypoint {
  return {
    x: round(landmark.x, 4),
    y: round(landmark.y, 4),
    z: round(landmark.z ?? 0, 4),
    visibility: round(landmark.visibility ?? 0, 3),
  };
}

function distance(a: PoseKeypoint, b: PoseKeypoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: PoseKeypoint, b: PoseKeypoint): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Local pose analysis: MediaPipe PoseLandmarker runs fully in the browser.
 * Only numeric landmarks and derived metrics are stored — never the video.
 */
export class PoseAnalyzer {
  private landmarker: PoseLandmarker | null = null;
  private options: PoseAnalyzerOptions;
  private running = false;
  private lastVideoTime = -1;
  private lastSampleAt = 0;
  private animationId: number | null = null;
  private previous: { keypoints: PoseKeypoint[]; timestamp: number } | null = null;
  private movementSamples: number[] = [];
  private brightnessCanvas: HTMLCanvasElement | null = null;
  private brightnessContext: CanvasRenderingContext2D | null = null;
  private frameCount = 0;
  private framesWithWristUp = 0;
  private targetFps: number;

  constructor(options: PoseAnalyzerOptions) {
    this.options = options;
    this.targetFps = Math.min(10, Math.max(5, options.targetFps ?? 8));
  }

  get isReady() {
    return Boolean(this.landmarker);
  }

  async init(): Promise<boolean> {
    if (this.landmarker) return true;
    if (typeof window === 'undefined') return false;
    this.options.onStatus?.('loading', 'Đang tải mô hình phân tích tư thế (chạy cục bộ).');
    try {
      const fileset = await FilesetResolver.forVisionTasks(this.options.wasmPath ?? WASM_PATH);
      this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: this.options.modelPath ?? MODEL_PATH,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.55,
        minPosePresenceConfidence: 0.55,
        minTrackingConfidence: 0.5,
      });
      this.options.onStatus?.('ready');
      return true;
    } catch (error) {
      console.warn('[Teacher Coach AI] Pose model failed to load:', error);
      try {
        // Retry with CPU delegate for devices without WebGL support.
        const fileset = await FilesetResolver.forVisionTasks(this.options.wasmPath ?? WASM_PATH);
        this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: this.options.modelPath ?? MODEL_PATH,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        this.options.onStatus?.('ready');
        return true;
      } catch (fallbackError) {
        console.warn('[Teacher Coach AI] Pose model CPU fallback failed:', fallbackError);
        this.options.onStatus?.(
          'error',
          'Không tải được mô hình phân tích tư thế. Video vẫn hoạt động nhưng không có phân tích tư thế.',
        );
        return false;
      }
    }
  }

  start() {
    if (!this.landmarker) {
      this.options.onStatus?.('error', 'Mô hình phân tích tư thế chưa sẵn sàng.');
      return;
    }
    if (this.running) return;
    this.running = true;
    this.lastVideoTime = -1;
    this.lastSampleAt = 0;
    this.previous = null;
    this.movementSamples = [];
    this.frameCount = 0;
    this.framesWithWristUp = 0;
    const loop = () => {
      if (!this.running) return;
      this.processFrame();
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    this.animationId = null;
    if (this.options.overlay) {
      const context = this.options.overlay.getContext('2d');
      context?.clearRect(0, 0, this.options.overlay.width, this.options.overlay.height);
    }
  }

  async close() {
    this.stop();
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch {
        // already closed
      }
      this.landmarker = null;
    }
  }

  getAggregates() {
    const averageMovement =
      this.movementSamples.length > 0 ? average(this.movementSamples) ?? 0 : 0;
    return {
      samples: this.frameCount,
      avgMovement: round(averageMovement, 4),
      gestureRatio: this.frameCount ? round(this.framesWithWristUp / this.frameCount, 3) : 0,
    };
  }

  private processFrame() {
    const { video } = this.options;
    if (!this.landmarker || !video || video.readyState < 2 || !video.videoWidth) return;

    const now = performance.now();
    const minimumInterval = 1000 / this.targetFps;
    if (now - this.lastSampleAt < minimumInterval) return;
    if (video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = video.currentTime;
    this.lastSampleAt = now;

    let result: PoseLandmarkerResult;
    try {
      result = this.landmarker.detectForVideo(video, now);
    } catch (error) {
      console.warn('[Teacher Coach AI] Pose detection frame failed:', error);
      return;
    }

    const landmarks = result.landmarks?.[0];
    if (!landmarks || landmarks.length < 25) {
      this.drawOverlay(null);
      return;
    }

    const keypoints = landmarks.slice(0, 33).map(toKeypoint);
    const metrics = this.computeMetrics(keypoints);
    const confidence = average(
      CORE_LANDMARKS.map((index) => keypoints[index]?.visibility ?? 0),
    ) ?? 0;

    const frame: PoseFrame = {
      timestamp: Date.now(),
      keypoints,
      metrics,
      confidence: round(clamp(confidence, 0, 1), 3),
    };

    this.frameCount += 1;
    const wristsUp = WRISTS.some((index) => {
      const wrist = keypoints[index];
      const shoulder = midpoint(keypoints[11], keypoints[12]);
      return wrist && wrist.visibility > 0.5 && wrist.y < shoulder.y - 0.02;
    });
    if (wristsUp) this.framesWithWristUp += 1;

    this.drawOverlay(keypoints);
    this.options.onFrame?.(frame);
  }

  private computeMetrics(keypoints: PoseKeypoint[]): PostureMetrics {
    const core = CORE_LANDMARKS.map((index) => keypoints[index]).filter(Boolean);
    const visible = core.filter((point) => point.visibility >= 0.5);
    const visibilityRatio = core.length ? visible.length / core.length : 0;

    const leftShoulder = keypoints[11];
    const rightShoulder = keypoints[12];
    const leftHip = keypoints[23];
    const rightHip = keypoints[24];
    const nose = keypoints[0];

    let centerOffsetX = 0;
    let centerOffsetY = 0;
    if (leftShoulder && rightShoulder && leftHip && rightHip) {
      const shoulderMid = midpoint(leftShoulder, rightShoulder);
      const hipMid = midpoint(leftHip, rightHip);
      centerOffsetX = round(shoulderMid.x - 0.5, 3);
      centerOffsetY = round((shoulderMid.y + hipMid.y) / 2 - 0.55, 3);
    } else if (nose) {
      centerOffsetX = round(nose.x - 0.5, 3);
      centerOffsetY = round(nose.y - 0.3, 3);
    }

    let shoulderTiltDeg = 0;
    if (leftShoulder && rightShoulder) {
      const dx = Math.abs(rightShoulder.x - leftShoulder.x);
      const dy = Math.abs(rightShoulder.y - leftShoulder.y);
      shoulderTiltDeg = dx > 0.0001 ? round((Math.atan2(dy, dx) * 180) / Math.PI, 1) : 0;
    }

    let movement = 0;
    let counting = 0;
    if (this.previous) {
      for (const index of [0, 11, 12, 13, 14, 23, 24, 25, 26]) {
        const current = keypoints[index];
        const before = this.previous.keypoints[index];
        if (!current || !before) continue;
        if (current.visibility < 0.4 || before.visibility < 0.4) continue;
        movement += distance(current, before);
        counting += 1;
      }
    }
    const delta = counting ? movement / counting : 0;
    if (delta > 0 && delta < 0.35) this.movementSamples.push(delta);
    if (this.movementSamples.length > 120) this.movementSamples.shift();

    const recent = this.movementSamples.slice(-24);
    const recentAverage = recent.length ? average(recent) ?? 0 : 0;
    const stability = round(clamp(1 - recentAverage * 14, 0, 1), 3);
    const movementIntensity = round(clamp(recentAverage * 18, 0, 1), 3);

    let wristAboveShoulderRatio = 0;
    if (leftShoulder && rightShoulder) {
      const shoulderMid = midpoint(leftShoulder, rightShoulder);
      const raised = WRISTS.filter((index) => {
        const wrist = keypoints[index];
        return wrist && wrist.visibility > 0.5 && wrist.y < shoulderMid.y - 0.02;
      });
      wristAboveShoulderRatio = round(raised.length / WRISTS.length, 2);
    }

    const brightness = this.sampleBrightness();

    this.previous = { keypoints, timestamp: Date.now() };

    return {
      visibilityRatio: round(visibilityRatio, 3),
      centerOffsetX,
      centerOffsetY,
      shoulderTiltDeg,
      stability,
      movementIntensity,
      wristAboveShoulderRatio,
      brightness,
    };
  }

  private sampleBrightness(): number | undefined {
    const { video } = this.options;
    if (!video.videoWidth) return undefined;
    if (!this.brightnessCanvas) {
      this.brightnessCanvas = document.createElement('canvas');
      this.brightnessCanvas.width = 64;
      this.brightnessCanvas.height = 36;
      this.brightnessContext = this.brightnessCanvas.getContext('2d', { willReadFrequently: true });
    }
    const context = this.brightnessContext;
    if (!context) return undefined;
    try {
      context.drawImage(video, 0, 0, 64, 36);
      const data = context.getImageData(0, 0, 64, 36).data;
      let sum = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        count += 1;
      }
      return round(count ? sum / count / 255 : 0, 3);
    } catch {
      return undefined;
    }
  }

  private drawOverlay(keypoints: PoseKeypoint[] | null) {
    const overlay = this.options.overlay;
    const { video } = this.options;
    if (!overlay) return;
    if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
      overlay.width = video.videoWidth || 640;
      overlay.height = video.videoHeight || 360;
    }
    const context = overlay.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, overlay.width, overlay.height);
    if (!keypoints) return;

    context.lineWidth = Math.max(2, overlay.width / 400);
    context.strokeStyle = 'rgba(143, 178, 255, 0.72)';
    context.shadowColor = 'rgba(109, 158, 255, 0.55)';
    context.shadowBlur = overlay.width / 90;

    for (const [from, to] of CONNECTIONS) {
      const a = keypoints[from];
      const b = keypoints[to];
      if (!a || !b) continue;
      if (a.visibility < 0.4 || b.visibility < 0.4) continue;
      context.beginPath();
      context.moveTo(a.x * overlay.width, a.y * overlay.height);
      context.lineTo(b.x * overlay.width, b.y * overlay.height);
      context.stroke();
    }
    context.shadowBlur = 0;
    for (const index of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
      const point = keypoints[index];
      if (!point || point.visibility < 0.4) continue;
      context.beginPath();
      context.arc(
        point.x * overlay.width,
        point.y * overlay.height,
        Math.max(2.2, overlay.width / 220),
        0,
        Math.PI * 2,
      );
      context.fillStyle = 'rgba(255, 255, 255, 0.92)';
      context.fill();
    }
  }
}

export function postureQuality(metrics: PostureMetrics | null): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  reason: string;
} {
  if (!metrics || metrics.visibilityRatio < 0.5) {
    return {
      label: 'Chưa đủ dữ liệu',
      tone: 'neutral',
      reason: 'Cần thấy rõ đầu, vai và hông trong khung hình để đánh giá tư thế.',
    };
  }
  const issues: string[] = [];
  if (Math.abs(metrics.centerOffsetX) > 0.16) issues.push('người lệch khỏi giữa khung hình');
  if (metrics.visibilityRatio < 0.8) issues.push('một phần cơ thể khuất khỏi camera');
  if (metrics.stability < 0.35 && metrics.movementIntensity > 0.55)
    issues.push('di chuyển quá nhiều, khó quan sát');
  if (metrics.stability > 0.9 && metrics.movementIntensity < 0.06)
    issues.push('đứng gần như bất động, thiếu cử chỉ minh họa');
  if (issues.length === 0) {
    return {
      label: 'Ổn định',
      tone: 'success',
      reason: 'Tư thế nằm trong vùng quan sát tốt và có chuyển động tự nhiên.',
    };
  }
  if (issues.length === 1) {
    return { label: 'Cần điều chỉnh nhẹ', tone: 'warning', reason: `Nhận thấy ${issues[0]}.` };
  }
  return { label: 'Cần chú ý', tone: 'warning', reason: `Nhận thấy ${issues.join('; ')}.` };
}
