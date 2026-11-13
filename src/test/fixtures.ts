import type {
  AudioObservation,
  LessonPhase,
  LessonPlan,
  PoseObservation,
  PracticeSession,
  SessionMetricsSummary,
  SessionReport,
  TranscriptSegment,
} from '@/types/domain';

export function makePhase(overrides: Partial<LessonPhase> = {}): LessonPhase {
  return {
    id: 'phase_1',
    order: 1,
    name: 'Khởi động',
    type: 'warmup',
    objective: 'Tạo hứng thú và kiểm tra kiến thức cũ.',
    teacherActions: ['Tổ chức trò chơi truyền điện.'],
    studentActions: ['Trả lời miệng.'],
    materials: [],
    questions: ['3 x 4 bằng bao nhiêu?'],
    expectedResponses: ['3 x 4 = 12'],
    completionCriteria: [],
    estimatedDurationMin: 5,
    confidence: 0.9,
    needsReview: false,
    ...overrides,
  };
}

export function makeLesson(overrides: Partial<LessonPlan> = {}): LessonPlan {
  const now = new Date('2026-01-01T08:00:00.000Z').toISOString();
  return {
    id: 'lesson_test',
    title: 'Bài 55: Bảng nhân 4',
    subject: 'Toán',
    grade: 2,
    topic: 'Bảng nhân 4',
    fileName: 'bai-hoc.txt',
    fileType: 'txt',
    fileSize: 1024,
    extractedText: 'Nội dung bài học.',
    objectives: [{ id: 'obj_1', text: 'Học sinh lập được bảng nhân 4.', confidence: 0.9, needsReview: false }],
    prerequisiteKnowledge: [],
    coreKnowledge: [],
    teachingMaterials: [],
    lessonPhases: [
      makePhase(),
      makePhase({
        id: 'phase_2',
        order: 2,
        name: 'Luyện tập',
        type: 'practice',
        questions: ['4 x 6 bằng bao nhiêu?'],
        expectedResponses: ['4 x 6 = 24'],
      }),
    ],
    exercises: [],
    expectedStudentResponses: [],
    assessmentCriteria: [],
    parsingStatus: 'confirmed',
    parsingIssues: [],
    confidence: 0.9,
    createdAt: now,
    updatedAt: now,
    confirmedAt: now,
    isDemo: false,
    ...overrides,
  };
}

export function makeSession(overrides: Partial<PracticeSession> = {}): PracticeSession {
  return {
    id: 'session_test',
    lessonPlanId: 'lesson_test',
    lessonTitle: 'Bài 55: Bảng nhân 4',
    mode: 'natural',
    startedAt: '2026-01-01T08:00:00.000Z',
    endedAt: '2026-01-01T08:05:00.000Z',
    durationSec: 300,
    status: 'completed',
    settings: {
      mode: 'natural',
      studentCount: 10,
      difficulty: 'medium',
      studentActivity: 55,
      feedbackFrequency: 'normal',
      recordingEnabled: false,
    },
    transcriptAvailable: true,
    cameraAvailable: false,
    poseAvailable: false,
    isDemo: false,
    ...overrides,
  };
}

export function makeTranscript(
  overrides: Partial<TranscriptSegment> = {},
): TranscriptSegment {
  return {
    id: 'transcript_test',
    sessionId: 'session_test',
    startTime: 10,
    endTime: 16,
    text: 'Xin chào các em, hôm nay chúng ta học bảng nhân 4.',
    speaker: 'teacher',
    confidence: 0.9,
    source: 'manual',
    ...overrides,
  };
}

export function makeAudio(overrides: Partial<AudioObservation> = {}): AudioObservation {
  return {
    id: 'audio_test',
    sessionId: 'session_test',
    kind: 'audio',
    timestamp: 12,
    volumeDb: -24,
    speechActivity: true,
    pauseDurationSec: 0,
    estimatedSpeakingRate: 145,
    confidence: 0.8,
    ...overrides,
  };
}

export function makePose(overrides: Partial<PoseObservation> = {}): PoseObservation {
  return {
    id: 'pose_test',
    sessionId: 'session_test',
    kind: 'pose',
    timestamp: 14,
    keypoints: [],
    postureMetrics: {
      visibilityRatio: 0.92,
      centerOffsetX: 0.02,
      centerOffsetY: 0.04,
      shoulderTiltDeg: 2,
      stability: 0.86,
      movementIntensity: 0.18,
      wristAboveShoulderRatio: 0.22,
      brightness: 0.62,
    },
    confidence: 0.85,
    ...overrides,
  };
}

export function makeMetrics(overrides: Partial<SessionMetricsSummary> = {}): SessionMetricsSummary {
  return {
    durationSec: 300,
    teacherSpeakingSec: 180,
    studentSpeakingSec: 0,
    speechRatio: 0.6,
    avgVolumeDb: -24,
    volumeVariabilityDb: 4.2,
    pauseCount: 4,
    avgPauseSec: 2.4,
    longestPauseSec: 4,
    wordsPerMinute: 145,
    questionCount: 4,
    openQuestionCount: 2,
    closedQuestionCount: 2,
    praiseCount: 2,
    encouragementCount: 1,
    transitionCount: 2,
    postureSamples: 30,
    postureVisibility: 0.9,
    postureStability: 0.85,
    gestureRate: 0.2,
    handRaiseCount: 3,
    answerCount: 3,
    wrongAnswerCount: 1,
    studentTurns: 4,
    phaseCount: 2,
    coveredPhaseCount: 2,
    ...overrides,
  };
}

export function makeReport(overrides: Partial<SessionReport> = {}): SessionReport {
  return {
    id: 'report_test',
    sessionId: 'session_test',
    lessonPlanId: 'lesson_test',
    lessonTitle: 'Bài 55: Bảng nhân 4',
    createdAt: '2026-01-01T08:06:00.000Z',
    overallScore: 72,
    overallConfidence: 0.7,
    competencies: [],
    strengths: [],
    improvements: [],
    timeline: [],
    evidence: [],
    metrics: makeMetrics(),
    phaseProgress: [],
    recommendations: [],
    generatedBy: 'rules',
    aiSummary: null,
    isDemo: false,
    ...overrides,
  };
}
