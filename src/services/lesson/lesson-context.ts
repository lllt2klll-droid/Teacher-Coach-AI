import type { LessonPhase, LessonPlan, StudentPersona } from '@/types/domain';
import { jaccardSimilarity, tokenize } from '@/services/nlp/vietnamese';

export interface LessonContextPhase {
  id: string;
  order: number;
  name: string;
  type: LessonPhase['type'];
  objective: string;
  teacherActions: string[];
  studentActions: string[];
  questions: string[];
  expectedResponses: string[];
  completionCriteria: string[];
  estimatedDurationMin: number;
}

export interface LessonContext {
  lessonId: string;
  title: string;
  subject: string;
  grade: number;
  topic: string;
  objectives: string[];
  prerequisiteKnowledge: string[];
  coreKnowledge: string[];
  expectedStudentResponses: string[];
  assessmentCriteria: string[];
  phases: LessonContextPhase[];
  currentPhaseId: string | null;
}

function toContextPhase(phase: LessonPhase): LessonContextPhase {
  return {
    id: phase.id,
    order: phase.order,
    name: phase.name,
    type: phase.type,
    objective: phase.objective,
    teacherActions: phase.teacherActions,
    studentActions: phase.studentActions,
    questions: phase.questions,
    expectedResponses: phase.expectedResponses,
    completionCriteria: phase.completionCriteria,
    estimatedDurationMin: phase.estimatedDurationMin,
  };
}

export function buildLessonContext(lesson: LessonPlan, currentPhaseId?: string | null): LessonContext {
  const phases = [...lesson.lessonPhases].sort((a, b) => a.order - b.order).map(toContextPhase);
  return {
    lessonId: lesson.id,
    title: lesson.title,
    subject: lesson.subject,
    grade: lesson.grade,
    topic: lesson.topic,
    objectives: lesson.objectives.map((objective) => objective.text),
    prerequisiteKnowledge: lesson.prerequisiteKnowledge,
    coreKnowledge: lesson.coreKnowledge,
    expectedStudentResponses: lesson.expectedStudentResponses,
    assessmentCriteria: lesson.assessmentCriteria,
    phases,
    currentPhaseId: currentPhaseId ?? phases[0]?.id ?? null,
  };
}

/**
 * Builds a compact context for an AI call. Never sends the whole lesson plan;
 * only the goal, current phase, relevant knowledge and recent turns.
 */
export function buildCompactPromptContext(
  lesson: LessonPlan,
  phaseId: string | null,
  student: StudentPersona | null,
  recentTurns: string[],
) {
  const phase = lesson.lessonPhases.find((entry) => entry.id === phaseId) ?? null;
  return {
    lesson: {
      title: lesson.title,
      subject: lesson.subject,
      grade: lesson.grade,
      topic: lesson.topic,
      objectives: lesson.objectives.slice(0, 4).map((objective) => objective.text),
      coreKnowledge: lesson.coreKnowledge.slice(0, 6),
    },
    phase: phase
      ? {
          name: phase.name,
          objective: phase.objective,
          questions: phase.questions.slice(0, 5),
          expectedResponses: phase.expectedResponses.slice(0, 5),
          teacherActions: phase.teacherActions.slice(0, 4),
        }
      : null,
    student: student
      ? {
          name: student.name,
          grade: student.grade,
          learningLevel: student.learningLevel,
          participationStyle: student.participationStyle,
          misconceptionProfile: student.misconceptionProfile.slice(0, 3),
          responseStyle: student.responseStyle,
        }
      : null,
    recentTurns: recentTurns.slice(-6),
  };
}

export function findPhaseById(lesson: LessonPlan, phaseId: string | null | undefined): LessonPhase | null {
  if (!phaseId) return null;
  return lesson.lessonPhases.find((phase) => phase.id === phaseId) ?? null;
}

export function lessonPhaseName(lesson: LessonPlan, phaseId: string | null | undefined): string | null {
  return findPhaseById(lesson, phaseId)?.name ?? null;
}

const PHASE_TYPE_HINTS: Record<LessonPhase['type'], string[]> = {
  warmup: ['khởi động', 'trò chơi', 'bắt đầu', 'ổn định lớp', 'vui', 'hát', 'kiểm tra bài cũ'],
  exploration: ['khám phá', 'quan sát', 'trải nghiệm', 'dự đoán', 'tình huống', 'thảo luận'],
  knowledge: ['hình thành kiến thức', 'kiến thức mới', 'ví dụ', 'nhận xét', 'quy tắc', 'kết luận', 'ghi nhớ', 'giảng'],
  practice: ['luyện tập', 'thực hành', 'bài tập', 'làm bài', 'bảng con', 'vở', 'phiếu'],
  application: ['vận dụng', 'thực tế', 'liên hệ', 'ứng dụng', 'cuộc sống'],
  consolidation: ['củng cố', 'tổng kết', 'nhắc lại', 'dặn dò', 'bài học hôm nay'],
  other: [],
};

export interface PhaseDetection {
  phaseId: string | null;
  confidence: number;
  score: number;
  reason: string;
  candidates: Array<{ phaseId: string; name: string; score: number }>;
}

/** Tracks lesson phase using utterance content only — never elapsed time. */
export class PhaseTracker {
  private lesson: LessonPlan;
  private currentPhaseId: string | null;
  private recentScores: Array<{ phaseId: string; score: number }> = [];
  private manualLockUntilTurn = 0;
  private turnCount = 0;

  constructor(lesson: LessonPlan, initialPhaseId?: string | null) {
    this.lesson = lesson;
    const phases = [...lesson.lessonPhases].sort((a, b) => a.order - b.order);
    this.currentPhaseId = initialPhaseId ?? phases[0]?.id ?? null;
  }

  getCurrentPhaseId(): string | null {
    return this.currentPhaseId;
  }

  setPhase(phaseId: string | null, manual = false) {
    this.currentPhaseId = phaseId;
    if (manual) this.manualLockUntilTurn = this.turnCount + 2;
  }

  evaluate(utterance: string): PhaseDetection {
    this.turnCount += 1;
    const phases = [...this.lesson.lessonPhases].sort((a, b) => a.order - b.order);
    if (!phases.length) {
      return { phaseId: null, confidence: 0, score: 0, reason: 'Bài dạy chưa có hoạt động', candidates: [] };
    }
    const tokens = new Set(tokenize(utterance));
    const candidates = phases.map((phase) => {
      let score = 0;
      score += jaccardSimilarity(utterance, phase.name) * 2.2;
      score += jaccardSimilarity(utterance, phase.objective) * 1.1;
      for (const hint of PHASE_TYPE_HINTS[phase.type]) {
        if (utterance.toLowerCase().includes(hint)) score += 1.1;
      }
      for (const question of phase.questions) {
        score += jaccardSimilarity(utterance, question) * 1.8;
      }
      for (const expected of phase.expectedResponses) {
        score += jaccardSimilarity(utterance, expected) * 0.8;
      }
      for (const action of phase.teacherActions) {
        score += jaccardSimilarity(utterance, action) * 0.9;
      }
      for (const token of tokenize(phase.name)) {
        if (tokens.has(token)) score += 0.25;
      }
      return { phaseId: phase.id, name: phase.name, score };
    });
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const current = candidates.find((candidate) => candidate.phaseId === this.currentPhaseId);
    const currentScore = current?.score ?? 0;
    this.recentScores.push({ phaseId: best.phaseId, score: best.score });
    if (this.recentScores.length > 4) this.recentScores.shift();

    let chosen = this.currentPhaseId;
    let confidence = 0;
    let reason = 'Giữ nguyên hoạt động hiện tại';
    if (best && best.score >= 1.15 && this.turnCount > this.manualLockUntilTurn) {
      const margin = best.score - currentScore;
      if (best.phaseId !== this.currentPhaseId && (margin > 0.45 || currentScore < 0.4)) {
        const repeated = this.recentScores.filter((entry) => entry.phaseId === best.phaseId).length >= 2;
        if (repeated || best.score >= 2.2) {
          chosen = best.phaseId;
          confidence = Math.min(0.92, 0.5 + best.score / 6 + margin / 4);
          reason = `Nội dung lời giảng khớp với hoạt động “${best.name}”`;
        }
      } else if (best.phaseId === this.currentPhaseId) {
        confidence = Math.min(0.9, 0.55 + best.score / 8);
        reason = 'Lời giảng tiếp tục khớp với hoạt động hiện tại';
      }
    }
    if (chosen) this.currentPhaseId = chosen;
    return {
      phaseId: this.currentPhaseId,
      confidence: Math.round(confidence * 100) / 100,
      score: best?.score ?? 0,
      reason,
      candidates: candidates.slice(0, 3).map((candidate) => ({
        phaseId: candidate.phaseId,
        name: candidate.name,
        score: Math.round(candidate.score * 100) / 100,
      })),
    };
  }
}

export function phaseIndex(lesson: LessonPlan, phaseId: string | null | undefined): number {
  if (!phaseId) return -1;
  const sorted = [...lesson.lessonPhases].sort((a, b) => a.order - b.order);
  return sorted.findIndex((phase) => phase.id === phaseId);
}

export function findExpectedAnswer(lesson: LessonPlan, phase: LessonPhase | null, question: string): string | null {
  const pool = [
    ...(phase?.questions.map((entry, index) => ({ question: entry, answer: phase.expectedResponses[index] })) ?? []),
    ...(phase?.expectedResponses ?? []).map((answer) => ({ question: phase?.objective ?? '', answer })),
  ].filter((entry): entry is { question: string; answer: string } => Boolean(entry.answer));
  let best: { answer: string; score: number } | null = null;
  for (const entry of pool) {
    const score = jaccardSimilarity(question, entry.question);
    if (!best || score > best.score) best = { answer: entry.answer, score };
  }
  for (const answer of lesson.expectedStudentResponses) {
    const score = jaccardSimilarity(question, answer) * 0.4;
    if (!best || score > best.score) best = { answer, score };
  }
  return best && best.score > 0.05 ? best.answer : null;
}
