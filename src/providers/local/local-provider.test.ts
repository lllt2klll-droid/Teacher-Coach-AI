import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalRuleProvider } from '@/providers/local/local-provider';
import { makeLesson, makePhase } from '@/test/fixtures';
import type { StudentPersona } from '@/types/domain';

function makeStudent(overrides: Partial<StudentPersona> = {}): StudentPersona {
  return {
    id: 'student_test',
    name: 'Minh Anh',
    avatarSeed: 1,
    color: '#7c5cff',
    grade: 2,
    learningLevel: 'advanced',
    participationStyle: 'high_achiever',
    knowledgeState: { 'bảng nhân 4': 0.95 },
    misconceptionProfile: [],
    responseStyle: {
      sentenceLength: 'medium',
      usesHesitation: false,
      confidenceTone: 'eager',
      commonPhrases: [],
    },
    behaviorRules: {
      handRaiseProbability: 0.8,
      distractionProbability: 0.05,
      needsEncouragement: false,
      answersWhenCalled: true,
      speaksWithoutPrompt: true,
    },
    participationRate: 0.8,
    ...overrides,
  };
}

describe('LocalRuleProvider student speech', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not duplicate the politeness particle when the parsed answer already ends with "ạ."', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const lesson = makeLesson({
      lessonPhases: [
        makePhase({
          questions: ['Mỗi tấm bìa có mấy chấm tròn?'],
          expectedResponses: ['Có tất cả 12 chấm tròn ạ.'],
        }),
        makePhase({ id: 'phase_2', order: 2 }),
      ],
    });
    const output = await new LocalRuleProvider().generateStudentResponse({
      lesson,
      phase: lesson.lessonPhases[0],
      student: makeStudent(),
      teacherText: 'Mỗi tấm bìa có mấy chấm tròn?',
      intent: 'question',
      difficulty: 'easy',
      recentTurns: [],
    });

    expect(output.text).toBe(
      'Thưa cô, có tất cả 12 chấm tròn ạ. Em có thể giải thích thêm nếu cô cần ạ.',
    );
    expect(output.text).not.toMatch(/ạ\s*ạ/);
    expect(output.text).not.toContain('Thưa cô, Có');
  });

  it('keeps the arithmetic explanation free of doubled particles', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const lesson = makeLesson({
      lessonPhases: [
        makePhase({
          questions: ['3 nhân 4 bằng bao nhiêu?'],
          expectedResponses: ['3 nhân 4 bằng 12 ạ.'],
        }),
        makePhase({ id: 'phase_2', order: 2 }),
      ],
    });
    const output = await new LocalRuleProvider().generateStudentResponse({
      lesson,
      phase: lesson.lessonPhases[0],
      student: makeStudent(),
      teacherText: '3 nhân 4 bằng bao nhiêu?',
      intent: 'question',
      difficulty: 'easy',
      recentTurns: [],
    });

    expect(output.text).toBe('Thưa cô, 3 × 4 = 12, vì 3 + 3 + 3 + 3 = 12 ạ.');
    expect(output.text).not.toMatch(/ạ\s*ạ/);
  });

  it('uses the current slide text when the answer is grounded in the presentation', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const phase = makePhase({ questions: [], expectedResponses: [] });
    const lesson = makeLesson({ lessonPhases: [phase] });
    const student = makeStudent();
    const presentation = {
      slideNumber: 2,
      totalSlides: 5,
      title: 'Quy tắc tính chu vi',
      text: 'Quy tắc: muốn tính chu vi hình vuông ta lấy cạnh nhân với 4.',
      outline: ['1. Khởi động', '2. Quy tắc tính chu vi'],
    };

    const withSlide = await new LocalRuleProvider().generateStudentResponse({
      lesson,
      phase,
      student,
      teacherText: 'Muốn tính chu vi hình vuông ta làm thế nào ạ?',
      intent: 'question',
      difficulty: 'easy',
      recentTurns: [],
      presentation,
    });
    const withoutSlide = await new LocalRuleProvider().generateStudentResponse({
      lesson,
      phase,
      student,
      teacherText: 'Muốn tính chu vi hình vuông ta làm thế nào ạ?',
      intent: 'question',
      difficulty: 'easy',
      recentTurns: [],
    });

    expect(withSlide.text).toContain('muốn tính chu vi hình vuông ta lấy cạnh nhân với 4');
    expect(withSlide.quality).toBe('correct');
    expect(withoutSlide.text).not.toContain('muốn tính chu vi hình vuông');
  });

  it('acknowledges the slide currently on screen when the teacher refers to it', async () => {
    const phase = makePhase();
    const lesson = makeLesson({ lessonPhases: [phase] });
    const output = await new LocalRuleProvider().generateStudentResponse({
      lesson,
      phase,
      student: makeStudent(),
      teacherText: 'Các em nhìn lên slide nhé.',
      intent: 'explanation',
      difficulty: 'easy',
      recentTurns: [],
      presentation: {
        slideNumber: 3,
        totalSlides: 6,
        title: 'Bảng nhân 4',
        text: '4 × 3 = 12',
        outline: ['1. Khởi động', '2. Bảng nhân 4', '3. Bảng nhân 4'],
      },
    });

    expect(output.text).toContain('slide “Bảng nhân 4”');
    expect(output.quality).toBe('neutral');
  });

  it('prefers the matching slide line when the teacher explicitly points at the slide', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const phase = makePhase({
      questions: ['Thế nào là hình vuông?'],
      expectedResponses: ['Hình vuông có bốn cạnh bằng nhau.'],
    });
    const lesson = makeLesson({ lessonPhases: [phase] });
    const output = await new LocalRuleProvider().generateStudentResponse({
      lesson,
      phase,
      student: makeStudent(),
      teacherText: 'Các em nhìn lên slide: muốn tính chu vi hình vuông ta làm thế nào?',
      intent: 'question',
      difficulty: 'easy',
      recentTurns: [],
      presentation: {
        slideNumber: 2,
        totalSlides: 5,
        title: 'Quy tắc tính chu vi',
        text: 'Muốn tính chu vi hình vuông, ta lấy độ dài một cạnh nhân với 4.',
        outline: ['1. Khởi động', '2. Quy tắc tính chu vi'],
      },
    });

    expect(output.text).toContain('lấy độ dài một cạnh nhân với 4');
    expect(output.text).not.toContain('bốn cạnh bằng nhau');
    expect(output.quality).toBe('correct');
  });
});
