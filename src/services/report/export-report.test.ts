import { describe, expect, it } from 'vitest';
import { buildReportHtml } from '@/services/report/export-report';
import { makeReport } from '@/test/fixtures';
import type { TrainingResult } from '@/types/domain';

const training: TrainingResult = {
  id: 'training_test',
  exerciseId: 'question_five_checks',
  exerciseTitle: 'Năm câu hỏi kiểm tra hiểu bài',
  startedAt: '2026-01-01T08:00:00.000Z',
  completedAt: '2026-01-01T08:06:00.000Z',
  durationSec: 360,
  sessionId: 'session_test',
  score: 100,
  passed: true,
  criteriaResults: [
    { criterionId: 'questions', label: 'Số câu hỏi', met: true, observed: 5, target: '≥ 5 câu' },
  ],
  isDemo: false,
};

describe('buildReportHtml', () => {
  it('includes the evidence, score and training result in a self-contained document', () => {
    const report = makeReport({
      overallScore: 72,
      evidence: [
        {
          id: 'e1',
          timestamp: 65,
          source: 'transcript',
          observedFact: 'Giáo viên đặt 5 câu hỏi.',
          interpretation: 'Có kiểm tra hiểu bài.',
          confidence: 0.8,
        },
      ],
      strengths: [
        { title: 'Đặt câu hỏi rõ', detail: 'Câu hỏi ngắn, đúng trọng tâm.', evidenceIds: ['e1'], category: 'pedagogy' },
      ],
      recommendations: ['Chờ học sinh suy nghĩ trước khi gợi ý.'],
    });
    const html = buildReportHtml(report, training);

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Bài 55: Bảng nhân 4');
    expect(html).toContain('72');
    expect(html).toContain('Giáo viên đặt 5 câu hỏi.');
    expect(html).toContain('Năm câu hỏi kiểm tra hiểu bài');
    expect(html).toContain('Đặt câu hỏi rõ');
    expect(html).toContain('Chờ học sinh suy nghĩ trước khi gợi ý.');
  });

  it('escapes user-provided text and labels DEMO reports', () => {
    const report = makeReport({
      lessonTitle: '<script>alert(1)</script>',
      overallScore: null,
      isDemo: true,
    });
    const html = buildReportHtml(report);

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('DEMO');
    expect(html).toContain('Chưa đủ dữ liệu để chấm');
  });
});
