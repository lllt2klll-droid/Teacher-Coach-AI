import type {
  LanguageAnalysisResult,
  LessonPlan,
  StudentPersona,
  TeacherIntent,
  TranscriptSegment,
} from '@/types/domain';
import type { AIProvider, StudentResponseInput, StudentResponseOutput } from '@/providers/types';
import {
  classifyQuestion,
  detectEncouragement,
  detectPraise,
  detectTransition,
  detectTeacherIntent,
  foldVietnamese,
  jaccardSimilarity,
  textContainsAny,
  tryArithmeticAnswer,
} from '@/services/nlp/vietnamese';
import { findExpectedAnswer } from '@/services/lesson/lesson-context';
import { shorten } from '@/services/nlp/vietnamese';

const BASE_MASTERY: Record<StudentPersona['learningLevel'], number> = {
  needs_support: 0.34,
  developing: 0.56,
  proficient: 0.76,
  advanced: 0.9,
};

export function masteryForStudent(student: StudentPersona, lesson: LessonPlan): number {
  const topicKey = lesson.topic.toLowerCase();
  const direct = Object.entries(student.knowledgeState).find(([key]) => topicKey.includes(key.toLowerCase()) || key.toLowerCase().includes(topicKey));
  const value = direct?.[1] ?? BASE_MASTERY[student.learningLevel];
  return Math.max(0.12, Math.min(0.98, value));
}

/**
 * Answers parsed from lesson plans often already end with politeness particles
 * such as "ạ." or "nhé.". Strip them before composing a sentence, otherwise the
 * student says "12 ạ ạ.".
 */
function stripTrailingPoliteness(text: string): string {
  return text
    .trim()
    .replace(/^[-–•*]\s*/, '')
    .replace(/\s*(?:ạ|à|nhé|nha)\s*[.!?…]*$/u, '')
    .replace(/[.!?…]+$/, '')
    .trim();
}

/** "Thưa cô, Có tất cả..." reads wrong; only the first letter is affected. */
function lowerFirst(text: string): string {
  if (!text) return text;
  // Vietnamese lowercase letters fall inside À..Ỹ, so use Unicode uppercase.
  if (/^\p{Lu}{2,}/u.test(text)) return text;
  return text.charAt(0).toLocaleLowerCase('vi') + text.slice(1);
}

function ensureSpoken(text: string): string {
  const trimmed = stripTrailingPoliteness(text).replace(/\s+/g, ' ');
  if (!trimmed) return 'Dạ, em chưa rõ ạ.';
  return `${trimmed} ạ.`;
}

function prefixFor(student: StudentPersona): string {
  switch (student.participationStyle) {
    case 'shy':
      return 'Dạ…';
    case 'support':
      return 'Thưa cô,';
    case 'distracted':
      return 'Ơ…';
    case 'curious':
      return 'Thưa cô,';
    case 'high_achiever':
      return 'Thưa cô,';
    default:
      return 'Thưa cô,';
  }
}

function answerSentence(answer: string, student: StudentPersona): string {
  const value = lowerFirst(stripTrailingPoliteness(answer));
  if (student.participationStyle === 'shy') return `Dạ… em nghĩ là ${value} ạ.`;
  if (student.participationStyle === 'support') return `Dạ, có phải ${value} không ạ?`;
  if (student.participationStyle === 'active') return `Thưa cô, ${value} ạ!`;
  if (student.participationStyle === 'high_achiever') return `Thưa cô, ${value} ạ.`;
  return `Thưa cô, ${value} ạ.`;
}

function findRelevantKnowledge(lesson: LessonPlan, question: string): string | null {
  let best: { text: string; score: number } | null = null;
  for (const item of lesson.coreKnowledge) {
    const score = jaccardSimilarity(question, item);
    if (!best || score > best.score) best = { text: item, score };
  }
  return best && best.score >= 0.08 ? best.text : null;
}

function findRelevantSlideLine(
  presentation: StudentResponseInput['presentation'],
  question: string,
): { text: string; score: number } | null {
  if (!presentation?.text) return null;
  const lines = presentation.text
    .split(/\n|(?<=[.!?…])\s+/u)
    .map((line) => line.replace(/^[-–•*]\s*/, '').trim())
    .filter((line) => line.length >= 8 && line.length <= 220);
  let best: { text: string; score: number } | null = null;
  for (const line of lines) {
    const score = jaccardSimilarity(question, line);
    if (!best || score > best.score) best = { text: line, score };
  }
  return best && best.score >= 0.07 ? best : null;
}

/** A teacher who explicitly points at the slide expects the students to read it. */
function referencesSlide(text: string): boolean {
  return /slide|trinh chieu|man hinh|bai giang/i.test(foldVietnamese(text));
}

function slideReference(presentation: StudentResponseInput['presentation']): string {
  if (!presentation?.title) return '';
  return `slide “${shorten(presentation.title, 42)}”`;
}

function futurePhaseQuestion(lesson: LessonPlan, phase: LessonPlan['lessonPhases'][number] | null, question: string): boolean {
  if (!phase) return false;
  const currentOrder = phase.order;
  return lesson.lessonPhases.some(
    (candidate) =>
      candidate.order > currentOrder + 1 &&
      candidate.questions.some((entry) => jaccardSimilarity(entry, question) > 0.5),
  );
}

function arithmeticExplanation(question: string): string | null {
  const arithmetic = tryArithmeticAnswer(question);
  if (!arithmetic) return null;
  const normalized = foldVietnamese(question);
  if (/(nhan|x|\*)/.test(normalized) && Number.isInteger(arithmetic.value) && arithmetic.value <= 60) {
    const parts = question.match(/(\d+)\s*(?:nhân|nhan|x|\*)\s*(\d+)/i);
    if (parts) {
      const left = Number(parts[1]);
      const right = Number(parts[2]);
      if (left <= 10 && right <= 10) {
        const repeated = Array.from({ length: right }, () => left).join(' + ');
        return `${left} × ${right} = ${arithmetic.value}, vì ${repeated} = ${arithmetic.value}`;
      }
    }
  }
  return null;
}

function wrongAnswerText(
  input: StudentResponseInput,
  expected: string | null,
  arithmetic: ReturnType<typeof tryArithmeticAnswer>,
): { text: string; partial: boolean } {
  const { student, teacherText } = input;
  if (arithmetic) {
    const normalized = foldVietnamese(teacherText);
    if (/(nhan|x|\*)/.test(normalized)) {
      const parts = teacherText.match(/(\d+)\s*(?:nhân|nhan|x|\*)\s*(\d+)/i);
      if (parts) {
        const left = Number(parts[1]);
        const right = Number(parts[2]);
        const mistaken = left + right;
        const style = student.participationStyle;
        const base = `Thưa cô, em nghĩ ${left} nhân ${right} bằng ${mistaken} ạ, vì ${left} cộng ${right} bằng ${mistaken}.`;
        if (style === 'shy') return { text: `Dạ… có phải ${left} nhân ${right} bằng ${mistaken} không ạ?`, partial: true };
        if (style === 'support') return { text: base, partial: false };
        return { text: base, partial: false };
      }
    }
  }
  if (expected) {
    const words = expected.split(/\s+/);
    if (words.length > 3) {
      const partial = words.slice(0, Math.max(2, Math.ceil(words.length / 2))).join(' ');
      return { text: `Thưa cô, em mới nghĩ được là ${partial}… ạ.`, partial: true };
    }
  }
  return {
    text:
      student.participationStyle === 'distracted'
        ? 'Ơ… cô ơi, em chưa nghe rõ câu hỏi ạ. Cô nhắc lại giúp em được không ạ?'
        : 'Thưa cô, em chưa hiểu câu hỏi này ạ. Cô gợi ý thêm giúp em được không ạ?',
    partial: false,
  };
}

export class LocalRuleProvider implements AIProvider {
  readonly id = 'local' as const;
  readonly label = 'Phân tích cục bộ (quy tắc)';
  readonly requiresServer = false;
  readonly kind = 'rules' as const;

  async testConnection() {
    return {
      ok: true,
      configured: true,
      message: 'Chế độ cục bộ đang hoạt động. Không có dữ liệu nào được gửi ra ngoài.',
    };
  }

  async classifyTeacherIntent(text: string, studentNames: string[]) {
    return detectTeacherIntent(text, studentNames);
  }

  async generateStudentResponse(input: StudentResponseInput): Promise<StudentResponseOutput> {
    const { student, teacherText, intent, phase, lesson, difficulty, presentation } = input;
    const question = classifyQuestion(teacherText);
    const mastery = masteryForStudent(student, lesson);

    if (intent === 'greeting') {
      return {
        text:
          student.participationStyle === 'shy'
            ? 'Dạ, chúng em chào cô ạ.'
            : 'Dạ! Chúng em chào cô ạ!',
        quality: 'neutral',
        eventType: 'PARTICIPATE_IN_ACTIVITY',
        confidence: 0.92,
        source: 'local_rules',
      };
    }

    if (intent === 'praise') {
      const text =
        student.participationStyle === 'shy'
          ? 'Dạ… em cảm ơn cô ạ.'
          : student.participationStyle === 'active'
            ? 'Dạ, em cảm ơn cô! Em sẽ cố gắng hơn nữa ạ!'
            : 'Dạ, em cảm ơn cô ạ.';
      return { text, quality: 'neutral', eventType: 'PARTICIPATE_IN_ACTIVITY', confidence: 0.86, source: 'local_rules' };
    }

    if (intent === 'group_work' || intent === 'instruction' || intent === 'exercise') {
      if (student.participationStyle === 'distracted' && Math.random() < 0.42) {
        return {
          text: 'Ơ… cô ơi, em chưa nghe rõ là mình cần làm gì ạ.',
          quality: 'neutral',
          eventType: 'DISTRACTED',
          confidence: 0.7,
          source: 'local_rules',
        };
      }
      if (student.participationStyle === 'support' && Math.random() < 0.38) {
        return {
          text: 'Thưa cô, em chưa hiểu cần viết vào đâu ạ. Cô chỉ lại giúp em với ạ.',
          quality: 'neutral',
          eventType: 'NEED_HELP',
          confidence: 0.72,
          source: 'local_rules',
        };
      }
      const slideNote =
        presentation?.title && ['active', 'high_achiever'].includes(student.participationStyle) && Math.random() < 0.4
          ? ` Em đang xem ${slideReference(presentation)} ạ.`
          : '';
      const text =
        student.participationStyle === 'shy'
          ? 'Dạ… em làm ạ.'
          : student.participationStyle === 'active'
            ? 'Dạ, em sẵn sàng làm bài ạ!'
            : 'Dạ, em làm bài ạ.';
      return {
        text: `${text}${slideNote}`,
        quality: 'neutral',
        eventType: intent === 'exercise' ? 'COMPLETE_EXERCISE' : 'PARTICIPATE_IN_ACTIVITY',
        confidence: 0.82,
        source: 'local_rules',
      };
    }

    if (!question.isQuestion) {
      if (intent === 'call_student') {
        return {
          text: 'Dạ, em nghe ạ. Cô muốn em làm gì ạ?',
          quality: 'neutral',
          eventType: 'PARTICIPATE_IN_ACTIVITY',
          confidence: 0.66,
          source: 'local_rules',
        };
      }
      if (presentation?.title && /slide|trinh chieu|man hinh|bai giang/i.test(foldVietnamese(teacherText))) {
        return {
          text: `Dạ, em đang xem ${slideReference(presentation)} ạ. Cô giảng tiếp giúp chúng em ạ.`,
          quality: 'neutral',
          eventType: 'PARTICIPATE_IN_ACTIVITY',
          confidence: 0.7,
          source: 'local_rules',
        };
      }
      return {
        text: 'Dạ, em đang chú ý ạ.',
        quality: 'neutral',
        eventType: 'PARTICIPATE_IN_ACTIVITY',
        confidence: 0.55,
        source: 'local_rules',
      };
    }

    if (input.forcedQuality === 'incorrect' || input.forcedQuality === 'partial') {
      const expectedForced = findExpectedAnswer(lesson, phase, teacherText);
      const arithmeticForced = tryArithmeticAnswer(teacherText);
      const wrong = wrongAnswerText(input, expectedForced, arithmeticForced);
      const partial = input.forcedQuality === 'partial' || wrong.partial;
      return {
        text: wrong.text,
        quality: partial ? 'partial' : 'incorrect',
        eventType: partial ? 'INCOMPLETE_ANSWER' : 'WRONG_ANSWER',
        confidence: 0.85,
        source: 'local_rules',
      };
    }

    if (futurePhaseQuestion(lesson, phase, teacherText)) {
      return {
        text: 'Thưa cô, phần này em chưa được học ạ. Em chưa biết ạ.',
        quality: 'neutral',
        eventType: 'NEED_HELP',
        confidence: 0.8,
        source: 'local_rules',
      };
    }

    if (student.participationStyle === 'curious' && question.openEnded && Math.random() < 0.28) {
      const arithmetic = tryArithmeticAnswer(teacherText);
      const followUp = arithmetic
        ? `Cô ơi, vì sao ${arithmetic.expression} lại cho kết quả như vậy ạ?`
        : presentation?.title
          ? `Cô ơi, ý “${shorten(presentation.title, 40)}” trên slide có nghĩa là gì ạ?`
          : `Cô ơi, vì sao chúng ta phải học phần “${shorten(lesson.topic, 32)}” ạ?`;
      return {
        text: followUp,
        quality: 'neutral',
        eventType: 'ASK_QUESTION',
        confidence: 0.64,
        source: 'local_rules',
      };
    }

    const arithmetic = tryArithmeticAnswer(teacherText);
    const slideLine = findRelevantSlideLine(presentation, teacherText);
    // When the teacher explicitly points at the slide and the question matches
    // the slide content, the slide wins over a weak answer from the lesson plan.
    const explicitSlideLine =
      referencesSlide(teacherText) && slideLine && slideLine.score >= 0.1 ? slideLine.text : null;
    const expected = explicitSlideLine ? null : findExpectedAnswer(lesson, phase, teacherText);
    const relevantKnowledge =
      expected || explicitSlideLine ? null : findRelevantKnowledge(lesson, teacherText);
    const relevantSlideLine =
      expected || relevantKnowledge ? null : explicitSlideLine ?? slideLine?.text ?? null;
    const correctChance =
      mastery + (difficulty === 'easy' ? 0.12 : difficulty === 'hard' ? -0.12 : 0) + (question.openEnded ? -0.05 : 0.02);
    const willAnswerCorrectly = Math.random() < Math.max(0.18, Math.min(0.95, correctChance));

    if (!willAnswerCorrectly) {
      if (student.participationStyle === 'shy' && Math.random() < 0.4) {
        return {
          text: 'Dạ… em chưa dám trả lời ạ. Cô cho em suy nghĩ thêm một chút được không ạ?',
          quality: 'neutral',
          eventType: 'NEED_HELP',
          confidence: 0.7,
          source: 'local_rules',
        };
      }
      const wrong = wrongAnswerText(input, expected, arithmetic);
      return {
        text: wrong.text,
        quality: wrong.partial ? 'partial' : 'incorrect',
        eventType: wrong.partial ? 'INCOMPLETE_ANSWER' : 'WRONG_ANSWER',
        confidence: 0.84,
        source: 'local_rules',
      };
    }

    let answerText: string | null = null;
    if (arithmetic) answerText = String(arithmetic.value);
    if (expected) answerText = expected;
    if (!answerText && relevantKnowledge) answerText = relevantKnowledge;
    if (!answerText && relevantSlideLine) answerText = relevantSlideLine;

    if (!answerText) {
      return {
        text: 'Thưa cô, em nghĩ là em chưa chắc câu trả lời ạ. Cô gợi ý giúp em được không ạ?',
        quality: 'neutral',
        eventType: 'NEED_HELP',
        confidence: 0.76,
        source: 'local_rules',
      };
    }

    let text = answerSentence(answerText, student);
    if (student.participationStyle === 'high_achiever' || (student.participationStyle === 'active' && mastery > 0.8)) {
      const explanation = arithmeticExplanation(teacherText);
      if (explanation && !answerText.includes('vì')) {
        text = `Thưa cô, ${lowerFirst(explanation)} ạ.`;
      } else if (expected && expected.split(/\s+/).length > 2) {
        text = `Thưa cô, ${lowerFirst(stripTrailingPoliteness(expected))} ạ. Em có thể giải thích thêm nếu cô cần ạ.`;
      }
    } else if (student.participationStyle === 'shy') {
      text = `Dạ… ${ensureSpoken(answerText).replace(/^Thưa cô,\s*/, '')}`;
    } else if (student.participationStyle === 'distracted') {
      text = `Ơ… ${ensureSpoken(answerText)}`;
    } else {
      text = `${prefixFor(student)} ${lowerFirst(ensureSpoken(answerText).replace(/^Thưa cô,\s*/, ''))}`;
    }

    return {
      text: text
        .replace(/(?:\s+ạ[.!]?)+(?=\s*[.!]?$)/u, ' ạ.')
        .replace(/\s+ạ\.\s*ạ\./g, ' ạ.')
        .replace(/\s{2,}/g, ' ')
        .trim(),
      quality: 'correct',
      eventType: 'ANSWER_QUESTION',
      confidence: Math.min(0.93, 0.66 + mastery * 0.25),
      source: 'local_rules',
    };
  }

  async analyzeTeachingLanguage(segments: TranscriptSegment[]): Promise<LanguageAnalysisResult> {
    const teacherSegments = segments.filter((segment) => segment.speaker === 'teacher');
    let questionCount = 0;
    let openQuestionCount = 0;
    let closedQuestionCount = 0;
    let probeQuestionCount = 0;
    let praiseCount = 0;
    let encouragementCount = 0;
    let transitionCount = 0;
    let greetingDetected = false;
    let summaryDetected = false;
    for (const segment of teacherSegments) {
      const question = classifyQuestion(segment.text);
      if (question.isQuestion) {
        questionCount += 1;
        if (question.kind === 'probe') probeQuestionCount += 1;
        else if (question.openEnded) openQuestionCount += 1;
        else closedQuestionCount += 1;
      }
      if (detectPraise(segment.text)) praiseCount += 1;
      if (detectEncouragement(segment.text)) encouragementCount += 1;
      if (detectTransition(segment.text)) transitionCount += 1;
      if (textContainsAny(segment.text, ['chào', 'xin chào'])) greetingDetected = true;
      if (textContainsAny(segment.text, ['tổng kết', 'củng cố', 'bài học hôm nay'])) summaryDetected = true;
    }
    const words = teacherSegments.reduce((sum, segment) => sum + segment.text.split(/\s+/).length, 0);
    const durationMin = teacherSegments.length
      ? Math.max(1 / 60, (teacherSegments[teacherSegments.length - 1].endTime - teacherSegments[0].startTime) / 60)
      : 0;
    const wpm = durationMin > 0.1 ? words / durationMin : null;
    let clarityScore: number | null = null;
    if (questionCount >= 3) {
      const openRatio = (openQuestionCount + probeQuestionCount) / questionCount;
      clarityScore = Math.round(Math.max(0, Math.min(1, 0.55 + openRatio * 0.3)) * 100) / 100;
    }
    return {
      segments: teacherSegments.length,
      questionCount,
      openQuestionCount,
      closedQuestionCount,
      probeQuestionCount,
      praiseCount,
      encouragementCount,
      transitionCount,
      greetingDetected,
      summaryDetected,
      clarityScore,
      notes: [
        questionCount
          ? `Có ${openQuestionCount + probeQuestionCount}/${questionCount} câu hỏi mở hoặc gợi mở.`
          : 'Chưa ghi nhận câu hỏi nào từ lời giảng.',
        wpm ? `Tốc độ nói ước tính ${Math.round(wpm)} từ/phút.` : 'Chưa đủ dữ liệu để ước tính tốc độ nói.',
      ],
      confidence: teacherSegments.length >= 4 ? 0.78 : 0.45,
    };
  }

  async summarizeSession() {
    return null;
  }
}

export function buildLocalProvider() {
  return new LocalRuleProvider();
}
