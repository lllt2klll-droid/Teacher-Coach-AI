import type {
  AnswerQuality,
  ClassroomEventType,
  Difficulty,
  LanguageAnalysisResult,
  LessonPlan,
  PracticeSession,
  PresentationContext,
  SessionReport,
  StudentPersona,
  TeacherIntent,
  TranscriptSegment,
} from '@/types/domain';
import type { TeacherIntentResult } from '@/services/nlp/vietnamese';

export interface StudentResponseInput {
  lesson: LessonPlan;
  phase: LessonPlan['lessonPhases'][number] | null;
  student: StudentPersona;
  teacherText: string;
  intent: TeacherIntent;
  questionKind?: string;
  difficulty: Difficulty;
  recentTurns: Array<{ speaker: string; text: string }>;
  forcedQuality?: AnswerQuality;
  scenario?: string;
  /** Current slide + outline when the teacher is presenting a local PPTX. */
  presentation?: PresentationContext | null;
}

export interface StudentResponseOutput {
  text: string;
  quality: AnswerQuality;
  eventType: ClassroomEventType;
  confidence: number;
  source: 'local_rules' | 'gemini';
}

export interface AIProvider {
  readonly id: 'local' | 'gemini';
  readonly label: string;
  readonly requiresServer: boolean;
  readonly kind: 'rules' | 'llm';

  testConnection(): Promise<{ ok: boolean; message: string; configured: boolean }>;
  generateStudentResponse(input: StudentResponseInput): Promise<StudentResponseOutput>;
  classifyTeacherIntent(text: string, studentNames: string[]): Promise<TeacherIntentResult>;
  analyzeTeachingLanguage(segments: TranscriptSegment[]): Promise<LanguageAnalysisResult>;
  summarizeSession(
    session: PracticeSession,
    report: SessionReport,
    transcript: TranscriptSegment[],
  ): Promise<{ summary: string; strengths: string[]; improvements: string[]; source: 'gemini' } | null>;
}

export interface AIProviderRuntime {
  kind: 'local' | 'gemini';
  endpoint: string;
  model: string;
  /**
   * Optional user-supplied Gemini key. It is sent only to the same-origin
   * proxy and is never persisted by the provider.
   */
  apiKey?: string;
}
