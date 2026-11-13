import { describe, expect, it } from 'vitest';
import type { ClassroomEvent } from '@/types/domain';
import { buildSessionReport, summarizeReportForAI } from './report-builder';
import {
  makeAudio,
  makeLesson,
  makePose,
  makeSession,
  makeTranscript,
} from '@/test/fixtures';

describe('buildSessionReport', () => {
  it('does not invent an overall score without enough data', () => {
    const report = buildSessionReport({
      session: makeSession(),
      lesson: makeLesson(),
      observations: [],
      transcripts: [],
      classroomEvents: [],
      feedback: [],
    });

    expect(report.overallScore).toBeNull();
    expect(report.metrics.durationSec).toBe(300);
    expect(report.metrics.teacherSpeakingSec).toBe(0);
    expect(report.competencies.filter((item) => item.insufficientData).map((item) => item.category)).toEqual(
      expect.arrayContaining(['pedagogy', 'voice', 'posture', 'presentation']),
    );
    expect(report.recommendations.join(' ')).toContain('Chưa đủ dữ liệu để tính điểm tổng');
    expect(report.evidence).toHaveLength(1);
    expect(report.evidence[0].source).toBe('lesson');
    expect(report.evidence[0].observedFact).toContain('0/2 hoạt động');
  });

  it('computes metrics and evidence from recorded observations and transcripts', () => {
    const audio = Array.from({ length: 20 }, (_, index) =>
      makeAudio({ id: `audio_${index}`, timestamp: index }),
    );
    const pose = Array.from({ length: 35 }, (_, index) =>
      makePose({ id: `pose_${index}`, timestamp: index }),
    );
    const transcripts = [
      makeTranscript({
        id: 't1',
        startTime: 0,
        endTime: 4,
        text: 'Xin chào các em, hôm nay chúng ta học bảng nhân 4.',
      }),
      makeTranscript({
        id: 't2',
        startTime: 5,
        endTime: 10,
        text: 'Em hãy quan sát tấm bìa và cho cô biết có mấy chấm tròn?',
      }),
      makeTranscript({
        id: 't3',
        startTime: 11,
        endTime: 15,
        text: 'Vì sao em biết bốn nhân hai bằng tám? Hãy giải thích cách làm.',
      }),
      makeTranscript({
        id: 't4',
        startTime: 16,
        endTime: 20,
        text: 'Đúng rồi, các em giỏi lắm. Bây giờ chúng ta chuyển sang hoạt động 2.',
      }),
      makeTranscript({
        id: 't5',
        startTime: 21,
        endTime: 26,
        text: 'Các em lập tiếp bảng nhân bốn theo nhóm đôi và ghi kết quả vào vở.',
      }),
      makeTranscript({
        id: 't6',
        startTime: 27,
        endTime: 32,
        text: 'Cô tổng kết bài học hôm nay và dặn dò các em học thuộc bảng nhân.',
      }),
    ];
    const events: ClassroomEvent[] = [
      {
        id: 'e1',
        sessionId: 'session_test',
        timestamp: 17,
        lessonPhaseId: 'phase_1',
        studentId: 'student_1',
        studentName: 'Minh Anh',
        eventType: 'ANSWER_QUESTION',
        response: 'Bốn nhân hai bằng tám ạ.',
        confidence: 0.85,
        quality: 'correct',
        source: 'local_rules',
      },
      {
        id: 'e2',
        sessionId: 'session_test',
        timestamp: 18,
        lessonPhaseId: 'phase_2',
        studentId: 'student_2',
        studentName: 'Gia Hân',
        eventType: 'RAISE_HAND',
        response: 'Em xung phong ạ.',
        confidence: 0.8,
        source: 'local_rules',
      },
    ];

    const report = buildSessionReport({
      session: makeSession(),
      lesson: makeLesson(),
      observations: [...audio, ...pose],
      transcripts,
      classroomEvents: events,
      feedback: [],
    });

    expect(report.metrics.teacherSpeakingSec).toBe(20);
    expect(report.metrics.questionCount).toBe(2);
    expect(report.metrics.openQuestionCount).toBe(1);
    expect(report.metrics.praiseCount).toBe(1);
    expect(report.metrics.transitionCount).toBe(1);
    expect(report.metrics.postureSamples).toBe(35);
    expect(report.metrics.postureVisibility).toBe(0.92);
    expect(report.metrics.answerCount).toBe(1);
    expect(report.metrics.handRaiseCount).toBe(1);
    expect(report.overallScore).not.toBeNull();
    expect(report.evidence.some((item) => item.source === 'audio')).toBe(true);
    expect(report.evidence.some((item) => item.source === 'pose')).toBe(true);
    expect(report.evidence.some((item) => item.source === 'transcript')).toBe(true);
    expect(summarizeReportForAI(report)).toContain('Bài 55: Bảng nhân 4');
  });

  it('inherits the DEMO label from the session', () => {
    const report = buildSessionReport({
      session: makeSession({ isDemo: true }),
      lesson: makeLesson({ isDemo: true }),
      observations: [],
      transcripts: [],
      classroomEvents: [],
      feedback: [],
    });
    expect(report.isDemo).toBe(true);
  });
});
