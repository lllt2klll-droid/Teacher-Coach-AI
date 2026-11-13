import type { LanguageAnalysisResult, PracticeSession, SessionReport, TranscriptSegment } from '@/types/domain';
import type { AIProvider, StudentResponseInput, StudentResponseOutput } from '@/providers/types';
import { LocalRuleProvider } from '@/providers/local/local-provider';

interface GeminiError {
  message: string;
  status?: number;
  configured?: boolean;
}

interface ServerStatus {
  ok: boolean;
  configured: boolean;
  message: string;
  model?: string;
}

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini' as const;
  readonly label = 'Gemini qua server proxy';
  readonly requiresServer = true;
  readonly kind = 'llm' as const;
  private local: LocalRuleProvider;
  private endpoint: string;
  private model: string;
  private apiKey: string;
  private statusCache: { at: number; status: ServerStatus } | null = null;

  constructor(endpoint: string, model: string, local = new LocalRuleProvider(), apiKey = '') {
    this.endpoint = endpoint || '/api/ai';
    this.model = model || 'gemini-2.5-flash';
    this.local = local;
    this.apiKey = apiKey.trim();
  }

  /**
   * The user-supplied key is only sent to a same-origin proxy. An absolute
   * third-party endpoint never receives it, so a mistyped endpoint cannot
   * leak the key.
   */
  private keyHeaders(): Record<string, string> {
    if (!this.apiKey) return {};
    if (/^https?:\/\//i.test(this.endpoint)) {
      try {
        const target = new URL(this.endpoint);
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        if (!origin || target.origin !== origin) return {};
      } catch {
        return {};
      }
    }
    return { 'x-gemini-key': this.apiKey };
  }

  private async post<T>(action: string, payload: unknown, timeoutMs = 15_000): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.keyHeaders() },
        body: JSON.stringify({ action, payload, model: this.model }),
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: T;
        message?: string;
        error?: string;
        configured?: boolean;
        model?: string;
      };
      if (!response.ok || !data.ok) {
        const error: GeminiError = {
          message: data.message || data.error || `Máy chủ AI trả về lỗi ${response.status}.`,
          status: response.status,
          configured: data.configured,
        };
        throw error;
      }
      return data.data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async ensureConfigured(): Promise<boolean> {
    if (this.statusCache && Date.now() - this.statusCache.at < 60_000) {
      return this.statusCache.status.configured && this.statusCache.status.ok;
    }
    const status = await this.testConnection().catch((error: GeminiError) => ({
      ok: false,
      configured: error.configured !== false,
      message: error.message,
    }));
    return status.configured && status.ok;
  }

  async testConnection(): Promise<ServerStatus> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25_000);
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.keyHeaders() },
        body: JSON.stringify({ action: 'test', model: this.model }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      const data = (await response.json().catch(() => ({}))) as ServerStatus & { error?: string };
      const status: ServerStatus = {
        ok: Boolean(data.ok),
        configured: Boolean(data.configured),
        message:
          data.message ||
          data.error ||
          (response.ok ? 'Đã kết nối máy chủ AI.' : `Máy chủ trả về HTTP ${response.status}.`),
        model: data.model,
      };
      this.statusCache = { at: Date.now(), status };
      return status;
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === 'AbortError'
          ? 'Máy chủ AI không phản hồi trong thời gian cho phép. Kiểm tra server proxy hoặc kết nối mạng.'
          : 'Không kết nối được máy chủ AI. Chạy `npm run dev` (proxy AI tích hợp) hoặc kiểm tra proxy /api/ai và biến môi trường trên Vercel.';
      const status: ServerStatus = { ok: false, configured: false, message };
      this.statusCache = { at: Date.now(), status };
      return status;
    }
  }

  async classifyTeacherIntent(text: string, studentNames: string[]) {
    return this.local.classifyTeacherIntent(text, studentNames);
  }

  async analyzeTeachingLanguage(segments: TranscriptSegment[]): Promise<LanguageAnalysisResult> {
    return this.local.analyzeTeachingLanguage(segments);
  }

  async generateStudentResponse(input: StudentResponseInput): Promise<StudentResponseOutput> {
    if (input.forcedQuality) {
      // Scenario training needs deterministic behaviour, so it uses the
      // transparent rule engine instead of the language model.
      return this.local.generateStudentResponse(input);
    }
    const configured = await this.ensureConfigured();
    if (!configured) {
      return this.local.generateStudentResponse(input);
    }
    try {
      const data = await this.post<{ text: string; quality: StudentResponseOutput['quality'] }>(
        'student.respond',
        {
          lesson: {
            title: input.lesson.title,
            subject: input.lesson.subject,
            grade: input.lesson.grade,
            topic: input.lesson.topic,
            objectives: input.lesson.objectives.map((objective) => objective.text),
            coreKnowledge: input.lesson.coreKnowledge,
          },
          phase: input.phase
            ? {
                name: input.phase.name,
                objective: input.phase.objective,
                questions: input.phase.questions,
                expectedResponses: input.phase.expectedResponses,
              }
            : null,
          student: {
            name: input.student.name,
            grade: input.student.grade,
            learningLevel: input.student.learningLevel,
            participationStyle: input.student.participationStyle,
            responseStyle: input.student.responseStyle,
            misconceptionProfile: input.student.misconceptionProfile,
          },
          teacherText: input.teacherText,
          recentTurns: input.recentTurns.slice(-6),
          presentation: input.presentation
            ? {
                slideNumber: input.presentation.slideNumber,
                totalSlides: input.presentation.totalSlides,
                title: input.presentation.title,
                text: input.presentation.text,
                outline: input.presentation.outline,
              }
            : null,
        },
        18_000,
      );
      const text = String(data?.text ?? '').trim();
      if (!text) return this.local.generateStudentResponse(input);
      const quality = data?.quality ?? 'neutral';
      const eventType =
        quality === 'correct'
          ? 'ANSWER_QUESTION'
          : quality === 'incorrect'
            ? 'WRONG_ANSWER'
            : quality === 'partial'
              ? 'INCOMPLETE_ANSWER'
              : text.includes('?')
                ? 'ASK_QUESTION'
                : 'PARTICIPATE_IN_ACTIVITY';
      return {
        text: text.slice(0, 500),
        quality,
        eventType,
        confidence: 0.84,
        source: 'gemini',
      };
    } catch (error) {
      const typed = error as GeminiError;
      console.warn('[Teacher Coach AI] Gemini student response failed, using local rules:', typed.message);
      if (typed.status === 429) {
        this.statusCache = {
          at: Date.now(),
          status: { ok: false, configured: true, message: typed.message },
        };
      }
      return this.local.generateStudentResponse(input);
    }
  }

  async summarizeSession(session: PracticeSession, report: SessionReport, transcript: TranscriptSegment[]) {
    const configured = await this.ensureConfigured();
    if (!configured) return null;
    try {
      const transcriptText = transcript
        .filter((segment) => segment.speaker === 'teacher' || segment.speaker === 'student')
        .slice(-80)
        .map((segment) => `[${Math.floor(segment.startTime)}s] ${segment.speaker === 'teacher' ? 'GV' : 'HS'}: ${segment.text}`)
        .join('\n')
        .slice(0, 14_000);
      const data = await this.post<{ summary: string; strengths: string[]; improvements: string[] }>(
        'session.summarize',
        {
          session: {
            lessonTitle: session.lessonTitle,
            durationSec: session.durationSec,
            mode: session.mode,
          },
          metrics: report.metrics,
          transcriptText,
        },
        30_000,
      );
      if (!data?.summary) return null;
      return {
        summary: String(data.summary).slice(0, 1500),
        strengths: (Array.isArray(data.strengths) ? data.strengths : []).slice(0, 4).map(String),
        improvements: (Array.isArray(data.improvements) ? data.improvements : []).slice(0, 4).map(String),
        source: 'gemini' as const,
      };
    } catch (error) {
      console.warn('[Teacher Coach AI] Gemini summary failed:', (error as GeminiError).message);
      return null;
    }
  }
}
