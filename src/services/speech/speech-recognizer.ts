export interface FinalSpeechResult {
  text: string;
  confidence: number;
  startTime: number;
  endTime: number;
}

export type SpeechStatus = 'unsupported' | 'idle' | 'starting' | 'listening' | 'error' | 'stopped';

interface SpeechRecognizerCallbacks {
  onInterim: (text: string) => void;
  onFinal: (result: FinalSpeechResult) => void;
  onStatus: (status: SpeechStatus, message?: string) => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const maybeWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return maybeWindow.SpeechRecognition ?? maybeWindow.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getRecognitionConstructor());
}

/**
 * Wrapper around the browser Web Speech API (Vietnamese). The browser
 * recognises speech; transcripts are never fabricated. If the browser does
 * not support it, the UI must offer a manual transcript fallback.
 */
export class SpeechRecognizer {
  private recognition: SpeechRecognitionLike | null = null;
  private active = false;
  private restartTimer: number | null = null;
  private restartCount = 0;
  private startedAt = 0;
  private segmentStartedAt = 0;
  private callbacks: SpeechRecognizerCallbacks;
  private clock: () => number;
  private lastError: string | null = null;

  constructor(callbacks: SpeechRecognizerCallbacks, clock: () => number) {
    this.callbacks = callbacks;
    this.clock = clock;
  }

  static isSupported() {
    return isSpeechRecognitionSupported();
  }

  start(): boolean {
    const Constructor = getRecognitionConstructor();
    if (!Constructor) {
      this.callbacks.onStatus('unsupported', 'Trình duyệt này không hỗ trợ Web Speech API. Bạn có thể nhập lời giảng thủ công.');
      return false;
    }
    if (this.active) return true;
    this.active = true;
    this.lastError = null;
    this.startedAt = performance.now();
    this.segmentStartedAt = 0;
    this.callbacks.onStatus('starting');
    const recognition = new Constructor();
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      this.restartCount = 0;
      this.callbacks.onStatus('listening');
    };
    recognition.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result[0];
        if (!alternative) continue;
        const text = alternative.transcript.trim();
        if (!text) continue;
        if (result.isFinal) {
          const endTime = this.clock();
          const startTime = this.segmentStartedAt || Math.max(0, endTime - Math.max(0.6, text.split(/\s+/).length * 0.4));
          this.callbacks.onFinal({
            text,
            confidence: Number.isFinite(alternative.confidence) && alternative.confidence > 0 ? alternative.confidence : 0.6,
            startTime,
            endTime,
          });
          this.segmentStartedAt = endTime;
        } else {
          interim += `${text} `;
        }
      }
      this.callbacks.onInterim(interim.trim());
    };
    recognition.onerror = (event) => {
      const code = event.error;
      if (code === 'no-speech') {
        return;
      }
      if (code === 'aborted') {
        return;
      }
      this.lastError = code;
      const messages: Record<string, string> = {
        'not-allowed': 'Bạn chưa cấp quyền micro cho nhận dạng giọng nói.',
        'service-not-allowed': 'Trình duyệt không cho phép dịch vụ nhận dạng giọng nói. Kiểm tra quyền micro.',
        'audio-capture': 'Không tìm thấy micro hoặc micro không khả dụng.',
        network: 'Nhận dạng giọng nói cần kết nối mạng. Kiểm tra kết nối hoặc dùng nhập thủ công.',
        'language-not-supported': 'Trình duyệt chưa hỗ trợ nhận dạng tiếng Việt. Hãy dùng nhập lời giảng thủ công.',
      };
      this.callbacks.onStatus('error', messages[code] || `Lỗi nhận dạng giọng nói: ${code}`);
      if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'language-not-supported') {
        this.active = false;
      }
    };
    recognition.onend = () => {
      if (!this.active) {
        this.callbacks.onStatus('stopped');
        return;
      }
      if (this.lastError === 'network' && this.restartCount > 2) {
        this.active = false;
        this.callbacks.onStatus('error', 'Nhận dạng giọng nói mất kết nối. Hãy nhập lời giảng thủ công hoặc thử lại.');
        return;
      }
      this.restartCount += 1;
      const delay = Math.min(4000, 300 + this.restartCount * 350);
      this.restartTimer = window.setTimeout(() => {
        if (!this.active) return;
        try {
          recognition.start();
        } catch {
          this.callbacks.onStatus('error', 'Không thể khởi động lại nhận dạng giọng nói.');
          this.active = false;
        }
      }, delay);
    };
    try {
      recognition.start();
      this.recognition = recognition;
      return true;
    } catch (error) {
      this.active = false;
      this.callbacks.onStatus('error', `Không thể bắt đầu nhận dạng: ${error instanceof Error ? error.message : 'lỗi không xác định'}`);
      return false;
    }
  }

  stop() {
    this.active = false;
    if (this.restartTimer !== null) {
      window.clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    try {
      this.recognition?.stop();
    } catch {
      // already stopped
    }
    this.recognition = null;
    this.callbacks.onStatus('stopped');
  }

  setManualFallbackUsed() {
    this.stop();
  }

  getElapsedSinceStart(): number {
    return (performance.now() - this.startedAt) / 1000;
  }
}
