import { describe, expect, it } from 'vitest';
import type { ClassroomEvent, TrainingExercise } from '@/types/domain';
import { evaluateTrainingExercise, buildTrainingResult, formatCriterionTarget } from './evaluate-training';
import { makeReport, makeTranscript } from '@/test/fixtures';

const exercise: TrainingExercise = {
  id: 'test_exercise',
  title: 'Bài luyện kiểm thử',
  group: 'questioning',
  description: 'Kiểm tra tiêu chí đặt câu hỏi và dữ liệu tư thế.',
  objective: 'Đặt đủ câu hỏi và giữ cơ thể trong khung hình.',
  instructions: [],
  durationMin: 3,
  criteria: [
    { id: 'questions', label: 'Số câu hỏi', metric: 'question_count', target: 2, comparison: 'gte', unit: 'lần' },
    {
      id: 'visibility',
      label: 'Độ hiển thị tư thế',
      metric: 'posture_visibility',
      target: 0.7,
      comparison: 'gte',
      unit: 'tỷ lệ',
    },
  ],
  usesStudents: false,
  difficulty: 'medium',
  isBuiltIn: true,
};

describe('evaluateTrainingExercise', () => {
  it('marks missing data as not evaluated instead of passing it', () => {
    const report = makeReport({ metrics: { ...makeReport().metrics, questionCount: 4, postureVisibility: null } });
    const result = evaluateTrainingExercise(exercise, report, [], []);
    expect(result.criteriaResults[0]).toMatchObject({ criterionId: 'questions', met: true });
    expect(result.criteriaResults[1]).toMatchObject({ criterionId: 'visibility', met: null });
    expect(result.score).toBe(100);
    expect(result.passed).toBeNull();
  });

  it('fails the exercise when an evaluated criterion is below target', () => {
    const report = makeReport({ metrics: { ...makeReport().metrics, questionCount: 1, postureVisibility: 0.9 } });
    const result = evaluateTrainingExercise(exercise, report, [], []);
    expect(result.criteriaResults[0]).toMatchObject({ criterionId: 'questions', met: false });
    expect(result.score).toBe(50);
    expect(result.passed).toBe(false);
  });

  it('passes only when every criterion has data and meets its target', () => {
    const report = makeReport({ metrics: { ...makeReport().metrics, questionCount: 3, postureVisibility: 0.9 } });
    const result = evaluateTrainingExercise(exercise, report, [], []);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('evaluates wrong-answer support from actual transcripts and classroom events', () => {
    const supportExercise: TrainingExercise = {
      ...exercise,
      criteria: [
        {
          id: 'support',
          label: 'Hỗ trợ sau câu trả lời sai',
          metric: 'wrong_answer_support',
          target: 1,
          comparison: 'gte',
          unit: 'tỷ lệ',
        },
      ],
    };
    const wrongEvent: ClassroomEvent = {
      id: 'event_1',
      sessionId: 'session_test',
      timestamp: 40,
      studentId: 'student_1',
      studentName: 'Minh Anh',
      eventType: 'WRONG_ANSWER',
      response: '4 x 6 = 20',
      confidence: 0.8,
      source: 'local_rules',
    };
    const transcript = makeTranscript({
      id: 'transcript_support',
      startTime: 42,
      text: 'Không sao đâu em, mình thử lại từng bước nhé.',
    });
    const report = makeReport({ metrics: { ...makeReport().metrics } });
    const result = evaluateTrainingExercise(supportExercise, report, [transcript], [wrongEvent]);
    expect(result.criteriaResults[0].observed).toBe(1);
    expect(result.passed).toBe(true);
  });

  it('formats criterion targets with the right unit', () => {
    expect(formatCriterionTarget(exercise.criteria[0])).toBe('≥ 2 lần');
    expect(formatCriterionTarget(exercise.criteria[1])).toBe('≥ 70%');
  });
});

describe('buildTrainingResult', () => {
  it('keeps the DEMO label and session link from the report', () => {
    const report = makeReport({
      isDemo: true,
      metrics: { ...makeReport().metrics, questionCount: 3, postureVisibility: 0.9 },
    });
    const result = buildTrainingResult(
      exercise,
      report,
      [],
      [],
      '2026-01-01T08:00:00.000Z',
      '2026-01-01T08:03:00.000Z',
    );
    expect(result.sessionId).toBe('session_test');
    expect(result.isDemo).toBe(true);
    expect(result.passed).toBe(true);
  });
});
