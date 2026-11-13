import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaDeviceOption } from '@/types/domain';

type MicState = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error';

interface MicMetrics {
  level: number;
  volumeDb: number;
  speaking: boolean;
  pauseSec: number;
  signalDetected: boolean;
}

interface MicHookResult extends MicMetrics {
  state: MicState;
  message: string | null;
  stream: MediaStream | null;
  devices: MediaDeviceOption[];
  activeDeviceId: string | null;
  start: (deviceId?: string) => Promise<boolean>;
  stop: () => void;
  refreshDevices: () => Promise<MediaDeviceOption[]>;
  getAnalyser: () => AnalyserNode | null;
  resetPause: () => void;
}

function micErrorMessage(error: unknown): { state: MicState; message: string } {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return {
        state: 'denied',
        message: 'Bạn đã từ chối quyền micro. Hãy bật quyền micro trong cài đặt trình duyệt rồi thử lại.',
      };
    }
    if (error.name === 'NotFoundError') {
      return { state: 'unavailable', message: 'Không tìm thấy micro. Hãy kiểm tra thiết bị đầu vào.' };
    }
    if (error.name === 'NotReadableError') {
      return { state: 'error', message: 'Micro đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi thử lại.' };
    }
  }
  return { state: 'error', message: 'Không thể khởi động micro. Kiểm tra thiết bị và quyền truy cập.' };
}

export function useMicrophone(): MicHookResult {
  const [state, setState] = useState<MicState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceOption[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MicMetrics>({
    level: 0,
    volumeDb: -100,
    speaking: false,
    pauseSec: 0,
    signalDetected: false,
  });
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVoiceAtRef = useRef<number>(0);
  const noiseFloorRef = useRef<number>(0.006);
  const signalRef = useRef(false);
  const speakingRef = useRef(false);
  const startingRef = useRef(false);
  const lastUpdateRef = useRef(0);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (contextRef.current) {
      void contextRef.current.close().catch(() => undefined);
      contextRef.current = null;
    }
    analyserRef.current = null;
    speakingRef.current = false;
    setStream(null);
    setState('idle');
    setActiveDeviceId(null);
    setMetrics({ level: 0, volumeDb: -100, speaking: false, pauseSec: 0, signalDetected: false });
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    const micros = all
      .filter((device) => device.kind === 'audioinput')
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Micro ${index + 1}`,
      }));
    setDevices(micros);
    return micros;
  }, []);

  const start = useCallback(
    async (deviceId?: string) => {
      if (startingRef.current) return false;
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable');
        setMessage('Trình duyệt này không hỗ trợ micro (MediaDevices API).');
        return false;
      }
      startingRef.current = true;
      stop();
      setState('requesting');
      setMessage(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
          video: false,
        });
        streamRef.current = stream;
        setStream(stream);
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const context = new AudioContextClass();
        await context.resume().catch(() => undefined);
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.65;
        source.connect(analyser);
        contextRef.current = context;
        analyserRef.current = analyser;
        lastVoiceAtRef.current = performance.now();
        const track = stream.getAudioTracks()[0];
        setActiveDeviceId(track?.getSettings().deviceId ?? deviceId ?? null);
        setState('ready');
        await refreshDevices();
        const buffer = new Float32Array(analyser.fftSize);
        const tick = () => {
          const activeAnalyser = analyserRef.current;
          if (!activeAnalyser) return;
          activeAnalyser.getFloatTimeDomainData(buffer);
          let sumSquares = 0;
          let peak = 0;
          for (let i = 0; i < buffer.length; i += 1) {
            const value = buffer[i];
            sumSquares += value * value;
            peak = Math.max(peak, Math.abs(value));
          }
          const rms = Math.sqrt(sumSquares / buffer.length);
          const db = rms > 0.00001 ? 20 * Math.log10(rms) : -100;
          const threshold = Math.max(0.012, noiseFloorRef.current * 2.1);
          const speakingNow = rms > threshold && db > -52;
          if (speakingNow) {
            lastVoiceAtRef.current = performance.now();
            signalRef.current = true;
          }
          if (!speakingNow && !speakingRef.current) {
            noiseFloorRef.current = noiseFloorRef.current * 0.985 + rms * 0.015;
          }
          const hangover = speakingRef.current && performance.now() - lastVoiceAtRef.current < 450;
          const active = speakingNow || hangover;
          const now = performance.now();
          if (now - lastUpdateRef.current > 100) {
            lastUpdateRef.current = now;
            const pause = active ? 0 : Math.min(600, Math.max(0, (now - lastVoiceAtRef.current) / 1000));
            setMetrics({
              level: Math.min(1, peak * 5),
              volumeDb: Math.round(db * 10) / 10,
              speaking: active,
              pauseSec: Math.round(pause * 10) / 10,
              signalDetected: signalRef.current,
            });
          }
          speakingRef.current = active;
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return true;
      } catch (error) {
        const mapped = micErrorMessage(error);
        setState(mapped.state);
        setMessage(mapped.message);
        return false;
      } finally {
        startingRef.current = false;
      }
    },
    [refreshDevices, stop],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
        streamRef.current = null;
      }
      if (contextRef.current) {
        void contextRef.current.close().catch(() => undefined);
        contextRef.current = null;
      }
    };
  }, []);

  return {
    ...metrics,
    state,
    message,
    stream,
    devices,
    activeDeviceId,
    start,
    stop,
    refreshDevices,
    getAnalyser: () => analyserRef.current,
    resetPause: () => {
      lastVoiceAtRef.current = performance.now();
      signalRef.current = true;
    },
  };
}
