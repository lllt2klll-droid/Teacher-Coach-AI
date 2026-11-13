import { useEffect, useRef, useState, type RefObject } from 'react';
import { PoseAnalyzer, type PoseFrame, type PoseStatus } from '@/services/analysis/pose-analyzer';

/**
 * Runs MediaPipe PoseLandmarker on the local video element only while enabled.
 * No video frame ever leaves the device; only numeric metrics are read by the
 * caller.
 */
export function usePoseAnalysis(
  videoRef: RefObject<HTMLVideoElement | null>,
  overlayRef: RefObject<HTMLCanvasElement | null>,
  enabled: boolean,
) {
  const analyzerRef = useRef<PoseAnalyzer | null>(null);
  const latestRef = useRef<PoseFrame | null>(null);
  const [status, setStatus] = useState<PoseStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      latestRef.current = null;
      setStatus('idle');
      setMessage(null);
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    const analyzer = new PoseAnalyzer({
      video,
      overlay: overlayRef.current,
      targetFps: 8,
      onFrame: (frame) => {
        latestRef.current = frame;
      },
      onStatus: (nextStatus, nextMessage) => {
        if (cancelled) return;
        setStatus(nextStatus);
        setMessage(nextMessage ?? null);
      },
    });
    analyzerRef.current = analyzer;

    void (async () => {
      const ready = await analyzer.init();
      if (cancelled) {
        void analyzer.close();
        return;
      }
      if (ready) analyzer.start();
    })();

    return () => {
      cancelled = true;
      analyzerRef.current = null;
      latestRef.current = null;
      void analyzer.close();
    };
  }, [enabled, overlayRef, videoRef]);

  return {
    status,
    message,
    getLatest: () => latestRef.current,
    isRunning: status === 'ready',
  };
}
