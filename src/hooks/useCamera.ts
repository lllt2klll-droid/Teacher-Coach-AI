import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { MediaDeviceOption } from '@/types/domain';

type CameraState = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error';

interface CameraHookResult {
  videoRef: RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  state: CameraState;
  message: string | null;
  devices: MediaDeviceOption[];
  activeDeviceId: string | null;
  dimensions: { width: number; height: number } | null;
  start: (deviceId?: string) => Promise<boolean>;
  stop: () => void;
  switchDevice: (deviceId: string) => Promise<boolean>;
  refreshDevices: () => Promise<MediaDeviceOption[]>;
  captureSnapshot: () => string | null;
}

function messageForError(error: unknown): { state: CameraState; message: string } {
  if (!(error instanceof DOMException)) {
    return { state: 'error', message: 'Không thể khởi động camera. Kiểm tra thiết bị và quyền truy cập.' };
  }
  switch (error.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        state: 'denied',
        message: 'Bạn đã từ chối quyền camera. Hãy bật lại quyền camera trong cài đặt trình duyệt rồi thử lại.',
      };
    case 'NotFoundError':
    case 'OverconstrainedError':
      return { state: 'unavailable', message: 'Không tìm thấy camera phù hợp. Hãy kiểm tra thiết bị hoặc chọn camera khác.' };
    case 'NotReadableError':
      return {
        state: 'error',
        message: 'Camera đang được ứng dụng khác sử dụng hoặc bị lỗi phần cứng. Hãy đóng ứng dụng khác rồi thử lại.',
      };
    case 'AbortError':
      return { state: 'error', message: 'Camera bị ngắt. Hãy thử khởi động lại camera.' };
    default:
      return { state: 'error', message: `Lỗi camera: ${error.message || error.name}` };
  }
}

export function useCamera(videoRef: RefObject<HTMLVideoElement | null>): CameraHookResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceOption[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false);

  const stop = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setDimensions(null);
    setState('idle');
    setMessage(null);
    setActiveDeviceId(null);
  }, [videoRef]);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    const cameras = all
      .filter((device) => device.kind === 'videoinput')
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${index + 1}`,
      }));
    setDevices(cameras);
    return cameras;
  }, []);

  const start = useCallback(
    async (deviceId?: string) => {
      if (startingRef.current) return false;
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable');
        setMessage('Trình duyệt này không hỗ trợ truy cập camera (MediaDevices API).');
        return false;
      }
      startingRef.current = true;
      setState('requesting');
      setMessage(null);
      stop();
      setState('requesting');
      try {
        const baseConstraints: MediaTrackConstraints = {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 24, max: 30 },
          facingMode: 'user',
        };
        let nextStream: MediaStream;
        try {
          nextStream = await navigator.mediaDevices.getUserMedia({
            video: deviceId ? { ...baseConstraints, deviceId: { exact: deviceId } } : baseConstraints,
            audio: false,
          });
        } catch (error) {
          if (deviceId && error instanceof DOMException && error.name === 'OverconstrainedError') {
            nextStream = await navigator.mediaDevices.getUserMedia({ video: baseConstraints, audio: false });
          } else {
            throw error;
          }
        }
        streamRef.current = nextStream;
        setStream(nextStream);
        const track = nextStream.getVideoTracks()[0];
        const settings = track?.getSettings();
        setActiveDeviceId(settings?.deviceId ?? deviceId ?? null);
        setDimensions({
          width: settings?.width ?? 1280,
          height: settings?.height ?? 720,
        });
        setState('ready');
        await refreshDevices();
        return true;
      } catch (error) {
        const mapped = messageForError(error);
        setState(mapped.state);
        setMessage(mapped.message);
        return false;
      } finally {
        startingRef.current = false;
      }
    },
    [refreshDevices, stop],
  );

  const switchDevice = useCallback(
    async (deviceId: string) => {
      return start(deviceId);
    },
    [start],
  );

  const captureSnapshot = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, [videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
      video.play().catch(() => {
        setMessage('Không thể phát video preview. Hãy bấm vào khung hình để tiếp tục.');
      });
    } else {
      video.srcObject = null;
    }
  }, [stream, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleLoaded = () => {
      if (video.videoWidth) setDimensions({ width: video.videoWidth, height: video.videoHeight });
    };
    video.addEventListener('loadedmetadata', handleLoaded);
    return () => video.removeEventListener('loadedmetadata', handleLoaded);
  }, [videoRef]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
        streamRef.current = null;
      }
    };
  }, []);

  return {
    videoRef,
    stream,
    state,
    message,
    devices,
    activeDeviceId,
    dimensions,
    start,
    stop,
    switchDevice,
    refreshDevices,
    captureSnapshot,
  };
}
