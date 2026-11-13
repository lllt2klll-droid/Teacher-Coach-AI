import { describe, expect, it } from 'vitest';
import { FeedbackEngine, summarizeFeedbackForReport, feedbackFrequencyDescription } from './feedback-engine';
import type { FeedbackSnapshot } from './feedback-engine';
import { makeTranscript } from '@/test/fixtures';

function makeSnapshot(overrides: Partial<FeedbackSnapshot> = {}): FeedbackSnapshot {
  return {
    sessionId: 'session_test',
    elapsed: 60,
    transcript: [],
    classroomEvents: [],
    audio: {
      samples: 0,
      speakingSec: 0,
      avgVolumeDb: null,
      volumeStdDb: null,
      pauseCount: 0,
      longestPauseSec: 0,
      wpm: null,
    },
    pose: {
      samples: 20,
      visibility: 0.2,
      stability: 0.8,
      movement: 0.1,
      gestureRate: 0.1,
      brightness: 0.6,
      centerOffsetX: 0,
    },
    phase: { currentName: 'Khởi động', transitions: 0, covered: 1, total: 2 },
    micActive: false,
    cameraActive: true,
    ...overrides,
  };
}

describe('FeedbackEngine', () => {
  it('emits a posture warning when the teacher is out of frame', () => {
    const engine = new FeedbackEngine('normal');
    const event = engine.evaluate(makeSnapshot());
    expect(event).not.toBeNull();
    expect(event).toMatchObject({
      ruleId: 'pose_out_of_frame',
      category: 'posture',
      severity: 'warning',
      live: true,
    });
    expect(event?.evidence.source).toBe('pose');
    expect(event?.evidence.observedFact).toContain('20 mẫu');
  });

  it('respects the minimum gap between live suggestions', () => {
    const engine = new FeedbackEngine('normal');
    expect(engine.evaluate(makeSnapshot({ elapsed: 60 }))).not.toBeNull();
    expect(engine.evaluate(makeSnapshot({ elapsed: 61 }))).toBeNull();
  });

  it('asks for a greeting only once when there is enough speech', () => {
    const engine = new FeedbackEngine('normal');
    const transcript = [
      makeTranscript({ id: 't1', startTime: 1, endTime: 5, text: 'Các em mở vở và ghi tên bài.' }),
      makeTranscript({ id: 't2', startTime: 6, endTime: 10, text: 'Quan sát bảng nhân và nhận xét.' }),
    ];
    const event = engine.evaluate(
      makeSnapshot({
        elapsed: 80,
        cameraActive: false,
        pose: { ...makeSnapshot().pose, samples: 0, visibility: null },
        transcript,
      }),
    );
    expect(event?.ruleId).toBe('missing_greeting');
    expect(event?.evidence.source).toBe('transcript');
  });

  it('summarizes feedback counts without inventing severity', () => {
    const engine = new FeedbackEngine('normal');
    const event = engine.evaluate(makeSnapshot());
    const summary = summarizeFeedbackForReport([event!]);
    expect(summary.counts.warning).toBe(1);
    expect(summary.counts.critical).toBe(0);
    expect(summary.byCategory.posture).toBe(1);
    expect(summary.topWarnings).toHaveLength(1);
  });

  it('describes the three frequency levels', () => {
    expect(feedbackFrequencyDescription('low')).toContain('100 giây');
    expect(feedbackFrequencyDescription('high')).toContain('25 giây');
    expect(feedbackFrequencyDescription('normal')).toContain('45 giây');
  });
});
