import { useCallback, useEffect, useRef, useState } from 'react';
import { recordingRepo } from '@/data/repositories';

export type RecordingState = 'idle' | 'recording' | 'saving' | 'saved' | 'error' | 'unsupported';

interface StopResolver {
  resolve: (ok: boolean) => void;
}

function pickMimeType(hasVideo: boolean): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = hasVideo
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? '';
}

/**
 * Optional local recording. It only starts after the teacher enabled a track
 * and explicitly started the session. The Blob is stored in IndexedDB and is
 * never uploaded.
 */
export function useSessionRecording() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const stopResolverRef = useRef<StopResolver | null>(null);
  const mimeRef = useRef('');
  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);

  const stop = useCallback((): Promise<boolean> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return Promise.resolve(true);
    }
    return new Promise<boolean>((resolve) => {
      stopResolverRef.current = { resolve };
      setState('saving');
      try {
        recorder.stop();
      } catch {
        stopResolverRef.current = null;
        setState('error');
        setError('Không dừng được bản ghi. Dữ liệu buổi luyện vẫn được giữ.');
        resolve(false);
      }
    });
  }, []);

  const start = useCallback((stream: MediaStream, sessionId: string): boolean => {
    if (typeof MediaRecorder === 'undefined') {
      setState('unsupported');
      setError('Trình duyệt này không hỗ trợ MediaRecorder. Bạn có thể tắt ghi hình trong cài đặt.');
      return false;
    }
    const tracks = stream.getTracks();
    if (!tracks.length) {
      setState('error');
      setError('Chưa có camera hoặc micro đang bật để ghi. Hãy bật thiết bị trước khi bắt đầu.');
      return false;
    }
    const hasVideo = stream.getVideoTracks().length > 0;
    const mimeType = pickMimeType(hasVideo);
    try {
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      sessionIdRef.current = sessionId;
      mimeRef.current = recorder.mimeType || mimeType || 'unknown';
      setError(null);
      setSavedSessionId(null);
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setState('error');
        setError('Bản ghi gặp lỗi. Buổi luyện vẫn tiếp tục và báo cáo vẫn dựa trên dữ liệu đo được.');
        stopResolverRef.current?.resolve(false);
        stopResolverRef.current = null;
      };
      recorder.onstop = () => {
        const chunks = chunksRef.current;
        chunksRef.current = [];
        const targetSession = sessionIdRef.current;
        const blob = chunks.length ? new Blob(chunks, { type: mimeRef.current }) : null;
        if (blob && blob.size > 0 && targetSession) {
          void recordingRepo
            .save({ sessionId: targetSession, blob, mimeType: mimeRef.current })
            .then(() => {
              setState('saved');
              setSavedSessionId(targetSession);
            })
            .catch((saveError) => {
              console.warn('[Teacher Coach AI] Could not save recording:', saveError);
              setState('error');
              setError('Không lưu được bản ghi vào IndexedDB. Bản ghi không được tải lên đâu cả.');
            })
            .finally(() => {
              stopResolverRef.current?.resolve(true);
              stopResolverRef.current = null;
            });
        } else {
          setState('idle');
          stopResolverRef.current?.resolve(true);
          stopResolverRef.current = null;
        }
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setState('recording');
      return true;
    } catch (recordError) {
      console.error('[Teacher Coach AI] Could not start recording:', recordError);
      setState('error');
      setError('Không bắt đầu được ghi hình/ghi âm trên trình duyệt này.');
      return false;
    }
  }, []);

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          // recorder already stopped
        }
      }
      recorderRef.current = null;
    };
  }, []);

  return {
    state,
    error,
    savedSessionId,
    start,
    stop,
    isRecording: state === 'recording',
    isSaving: state === 'saving',
    isSupported: typeof MediaRecorder !== 'undefined',
  };
}
