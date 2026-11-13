import type {
  AudioObservation,
  ClassroomEvent,
  CompetencyScore,
  EvidenceItem,
  FeedbackCategory,
  FeedbackEvent,
  LessonPhase,
  LessonPlan,
  ObservationRecord,
  PhaseProgress,
  PoseObservation,
  PracticeSession,
  ReportInsight,
  SessionMetricsSummary,
  SessionReport,
  TranscriptSegment,
} from '@/types/domain';
import { PhaseTracker } from '@/services/lesson/lesson-context';
import { average, clamp, round, standardDeviation, uid } from '@/lib/utils';
import {
  classifyQuestion,
  detectEncouragement,
  detectPraise,
  detectTransition,
} from '@/services/nlp/vietnamese';
import { CATEGORY_LABELS, CATEGORY_WEIGHTS } from '@/lib/format';

export interface AISummaryInput {
  summary: string;
  strengths: string[];
  improvements: string[];
  source: 'gemini';
}

export interface BuildReportInput {
  session: PracticeSession;
  lesson: LessonPlan;
  observations: ObservationRecord[];
  transcripts: TranscriptSegment[];
  classroomEvents: ClassroomEvent[];
  feedback: FeedbackEvent[];
  aiSummary?: AISummaryInput | null;
}

function isAudio(observation: ObservationRecord): observation is AudioObservation {
  return observation.kind === 'audio';
}

function isPose(observation: ObservationRecord): observation is PoseObservation {
  return observation.kind === 'pose';
}

function sampleInterval(rows: Array<{ timestamp: number }>, index: number): number {
  const current = rows[index];
  const next = rows[index + 1];
  if (next) return clamp(next.timestamp - current.timestamp, 0.25, 5);
  const previous = rows[index - 1];
  if (previous) return clamp(current.timestamp - previous.timestamp, 0.25, 5);
  return 1;
}

function rangeScore(value: number, idealMin: number, idealMax: number, falloff: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= idealMin && value <= idealMax) return 100;
  if (value < idealMin) return clamp(100 - ((idealMin - value) / falloff) * 40, 20, 100);
  return clamp(100 - ((value - idealMax) / falloff) * 40, 20, 100);
}

function weighted(entries: Array<{ score: number | null; weight: number }>): number | null {
  const available = entries.filter((entry): entry is { score: number; weight: number } => entry.score !== null);
  if (!available.length) return null;
  const totalWeight = available.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) return null;
  return Math.round(available.reduce((sum, entry) => sum + entry.score * entry.weight, 0) / totalWeight);
}

function computePhaseProgress(
  lesson: LessonPlan,
  transcripts: TranscriptSegment[],
  classroomEvents: ClassroomEvent[],
  durationSec: number,
): PhaseProgress[] {
  const phases = [...lesson.lessonPhases].sort((a, b) => a.order - b.order);
  if (!phases.length) return [];
  const timestamps = new Map<string, number[]>();
  const confidence = new Map<string, number>();
  const tracker = new PhaseTracker(lesson);
  const teacherSegments = transcripts
    .filter((segment) => segment.speaker === 'teacher')
    .sort((a, b) => a.startTime - b.startTime);
  for (const segment of teacherSegments) {
    const detection = tracker.evaluate(segment.text);
    if (!detection.phaseId) continue;
    if (detection.confidence < 0.45) continue;
    const list = timestamps.get(detection.phaseId) ?? [];
    list.push(segment.startTime);
    timestamps.set(detection.phaseId, list);
    confidence.set(detection.phaseId, Math.max(confidence.get(detection.phaseId) ?? 0, detection.confidence));
  }
  for (const event of classroomEvents) {
    if (!event.lessonPhaseId) continue;
    const list = timestamps.get(event.lessonPhaseId) ?? [];
    list.push(event.timestamp);
    timestamps.set(event.lessonPhaseId, list);
    confidence.set(event.lessonPhaseId, Math.max(confidence.get(event.lessonPhaseId) ?? 0, 0.62));
  }
  return phases.map<PhaseProgress>((phase) => {
    const evidence = (timestamps.get(phase.id) ?? []).sort((a, b) => a - b);
    return {
      phaseId: phase.id,
      name: phase.name,
      type: phase.type,
      covered: evidence.length > 0,
      evidenceTimestamps: evidence.slice(0, 8),
      coverageConfidence: evidence.length ? round(confidence.get(phase.id) ?? 0.5, 2) : 0,
    };
  });
}

function computeMetrics(
  session: PracticeSession,
  transcripts: TranscriptSegment[],
  classroomEvents: ClassroomEvent[],
  observations: ObservationRecord[],
  phaseProgress: PhaseProgress[],
): SessionMetricsSummary {
  const audioRows = observations.filter(isAudio).sort((a, b) => a.timestamp - b.timestamp);
  const poseRows = observations.filter(isPose).sort((a, b) => a.timestamp - b.timestamp);
  const teacherSegments = transcripts.filter((segment) => segment.speaker === 'teacher');

  let teacherSpeakingSec = 0;
  let pauseCount = 0;
  let longestPauseSec = 0;
  const pauseDurations: number[] = [];
  let pauseRun = 0;
  let sawSpeech = false;
  const speakingVolumes: number[] = [];

  audioRows.forEach((row, index) => {
    const interval = sampleInterval(audioRows, index);
    if (row.speechActivity) {
      teacherSpeakingSec += interval;
      speakingVolumes.push(row.volumeDb);
      if (pauseRun >= 2) {
        pauseCount += 1;
        pauseDurations.push(pauseRun);
        longestPauseSec = Math.max(longestPauseSec, pauseRun);
      }
      pauseRun = 0;
      sawSpeech = true;
    } else if (sawSpeech) {
      pauseRun += interval;
    }
  });
  if (pauseRun >= 2) {
    pauseCount += 1;
    pauseDurations.push(pauseRun);
    longestPauseSec = Math.max(longestPauseSec, pauseRun);
  }

  const volumeAvg = average(speakingVolumes);
  const volumeStd = standardDeviation(speakingVolumes);

  let words = 0;
  let transcriptSpeakingSec = 0;
  let questionCount = 0;
  let openQuestionCount = 0;
  let closedQuestionCount = 0;
  let praiseCount = 0;
  let encouragementCount = 0;
  let transitionCount = 0;

  for (const segment of teacherSegments) {
    words += segment.text.split(/\s+/).filter(Boolean).length;
    if (segment.endTime > segment.startTime) {
      transcriptSpeakingSec += clamp(segment.endTime - segment.startTime, 0, 30);
    }
    const question = classifyQuestion(segment.text);
    if (question.isQuestion) {
      questionCount += 1;
      if (question.openEnded) openQuestionCount += 1;
      else closedQuestionCount += 1;
    }
    if (detectPraise(segment.text)) praiseCount += 1;
    if (detectEncouragement(segment.text)) encouragementCount += 1;
    if (detectTransition(segment.text)) transitionCount += 1;
  }

  const wpm = transcriptSpeakingSec >= 8 && words >= 15 ? words / (transcriptSpeakingSec / 60) : null;
  const durationSec = Math.max(1, session.durationSec);
  const visibility = average(
    poseRows.map((row) => row.postureMetrics.visibilityRatio).filter((value) => Number.isFinite(value)),
  );
  const stability = average(
    poseRows.map((row) => row.postureMetrics.stability).filter((value) => Number.isFinite(value)),
  );
  const gestureRate = poseRows.length
    ? poseRows.filter((row) => row.postureMetrics.wristAboveShoulderRatio >= 0.3).length / poseRows.length
    : null;

  const studentTurns = classroomEvents.filter((event) =>
    ['ANSWER_QUESTION', 'WRONG_ANSWER', 'INCOMPLETE_ANSWER', 'ASK_QUESTION', 'NEED_HELP', 'COMPLETE_EXERCISE', 'DISTRACTED'].includes(
      event.eventType,
    ),
  ).length;
  const answerCount = classroomEvents.filter((event) =>
    ['ANSWER_QUESTION', 'WRONG_ANSWER', 'INCOMPLETE_ANSWER'].includes(event.eventType),
  ).length;
  const wrongAnswerCount = classroomEvents.filter((event) => event.eventType === 'WRONG_ANSWER').length;
  const handRaiseCount = classroomEvents.filter((event) => event.eventType === 'RAISE_HAND').length;

  const covered = phaseProgress.filter((phase) => phase.covered).length;

  return {
    durationSec,
    teacherSpeakingSec: Math.round(teacherSpeakingSec),
    studentSpeakingSec: 0,
    speechRatio: round(clamp(teacherSpeakingSec / durationSec, 0, 1), 2),
    avgVolumeDb: volumeAvg === null ? null : round(volumeAvg, 1),
    volumeVariabilityDb: volumeStd === null ? null : round(volumeStd, 2),
    pauseCount,
    avgPauseSec: pauseDurations.length
      ? round(pauseDurations.reduce((sum, value) => sum + value, 0) / pauseDurations.length, 1)
      : null,
    longestPauseSec: round(longestPauseSec, 1),
    wordsPerMinute: wpm === null ? null : Math.round(wpm),
    questionCount,
    openQuestionCount,
    closedQuestionCount,
    praiseCount,
    encouragementCount,
    transitionCount,
    postureSamples: poseRows.length,
    postureVisibility: visibility === null ? null : round(visibility, 2),
    postureStability: stability === null ? null : round(stability, 2),
    gestureRate: gestureRate === null ? null : round(gestureRate, 2),
    handRaiseCount,
    answerCount,
    wrongAnswerCount,
    studentTurns,
    phaseCount: phaseProgress.length,
    coveredPhaseCount: covered,
  };
}

interface ScoreContext {
  session: PracticeSession;
  lesson: LessonPlan;
  metrics: SessionMetricsSummary;
  transcripts: TranscriptSegment[];
  classroomEvents: ClassroomEvent[];
  phaseProgress: PhaseProgress[];
  teacherSegments: TranscriptSegment[];
}

function scorePedagogy(context: ScoreContext): CompetencyScore {
  const { metrics, teacherSegments, phaseProgress } = context;
  const words = teacherSegments.reduce(
    (sum, segment) => sum + segment.text.split(/\s+/).filter(Boolean).length,
    0,
  );
  const sufficient = teacherSegments.length >= 5 && words >= 40;
  if (!sufficient) {
    return {
      category: 'pedagogy',
      label: CATEGORY_LABELS.pedagogy,
      score: null,
      confidence: 0.3,
      evidenceIds: [],
      insufficientData: true,
      sampleSize: teacherSegments.length,
      notes:
        'Chưa đủ lời giảng được nhận dạng để đánh giá ngôn ngữ sư phạm. Hãy bật micro hoặc nhập lời giảng thủ công trong buổi tiếp theo.',
    };
  }
  const questionsPerFive = metrics.questionCount / Math.max(0.15, metrics.durationSec / 300);
  const questionScore = rangeScore(questionsPerFive, 2.5, 14, 3);
  const openShare =
    metrics.questionCount > 0 ? metrics.openQuestionCount / metrics.questionCount : 0;
  const varietyScore = metrics.questionCount >= 3 ? rangeScore(openShare, 0.25, 0.7, 0.35) : null;
  const praiseScore =
    metrics.praiseCount >= 2 ? 92 : metrics.praiseCount === 1 ? 78 : metrics.studentTurns >= 3 ? 58 : null;
  const coveredCount = phaseProgress.filter((phase) => phase.covered).length;
  const transitionScore =
    coveredCount >= 2 ? (metrics.transitionCount > 0 ? 88 : 62) : null;
  const paceScore = metrics.wordsPerMinute ? rangeScore(metrics.wordsPerMinute, 110, 185, 55) : null;
  const score = weighted([
    { score: questionScore, weight: 1.3 },
    { score: varietyScore, weight: 1 },
    { score: praiseScore, weight: 0.9 },
    { score: transitionScore, weight: 0.8 },
    { score: paceScore, weight: 0.7 },
  ]);
  const confidence = round(clamp(0.45 + teacherSegments.length / 45 + words / 900, 0.45, 0.9), 2);
  return {
    category: 'pedagogy',
    label: CATEGORY_LABELS.pedagogy,
    score,
    confidence,
    evidenceIds: [],
    insufficientData: score === null,
    sampleSize: teacherSegments.length,
    notes: `Dựa trên ${teacherSegments.length} lượt lời giảng, ${metrics.questionCount} câu hỏi (${metrics.openQuestionCount} câu mở/gợi mở) và ${metrics.praiseCount} lời khen đã nhận dạng. Không đánh giá giọng điệu cảm xúc.`,
  };
}

function scoreVoice(context: ScoreContext): CompetencyScore {
  const { metrics } = context;
  const sufficient = metrics.teacherSpeakingSec >= 20 && metrics.avgVolumeDb !== null;
  if (!sufficient) {
    return {
      category: 'voice',
      label: CATEGORY_LABELS.voice,
      score: null,
      confidence: 0.25,
      evidenceIds: [],
      insufficientData: true,
      sampleSize: 0,
      notes:
        'Chưa đủ dữ liệu âm thanh (cần ít nhất 20 giây có tiếng nói). Hãy bật micro và kiểm tra mức âm lượng trước buổi tập.',
    };
  }
  const volumeScore =
    metrics.avgVolumeDb === null
      ? null
      : metrics.avgVolumeDb < -45
        ? 48
        : metrics.avgVolumeDb < -38
          ? 68
          : metrics.avgVolumeDb > -6
            ? 72
            : 90;
  const variabilityScore =
    metrics.volumeVariabilityDb === null
      ? null
      : rangeScore(metrics.volumeVariabilityDb, 1, 6, 4);
  const ratio = metrics.speechRatio;
  const ratioScore = ratio > 0.92 ? 55 : ratio < 0.2 ? 62 : rangeScore(ratio, 0.35, 0.82, 0.3);
  const pauseScore =
    metrics.durationSec < 90
      ? null
      : metrics.pauseCount === 0
        ? 62
        : metrics.pauseCount > 18
          ? 68
          : metrics.pauseCount >= 2
            ? 90
            : 76;
  const paceScore = metrics.wordsPerMinute ? rangeScore(metrics.wordsPerMinute, 110, 185, 55) : null;
  const score = weighted([
    { score: volumeScore, weight: 1.3 },
    { score: variabilityScore, weight: 0.8 },
    { score: ratioScore, weight: 1 },
    { score: pauseScore, weight: 0.8 },
    { score: paceScore, weight: 0.7 },
  ]);
  return {
    category: 'voice',
    label: CATEGORY_LABELS.voice,
    score,
    confidence: round(clamp(0.5 + metrics.teacherSpeakingSec / 240, 0.5, 0.9), 2),
    evidenceIds: [],
    insufficientData: score === null,
    sampleSize: metrics.teacherSpeakingSec,
    notes: `Dựa trên ${metrics.teacherSpeakingSec} giây có tiếng nói. Các chỉ số là phép đo tương đối từ micro, không suy đoán cảm xúc hay chất giọng bẩm sinh.`,
  };
}

function scorePosture(context: ScoreContext): CompetencyScore {
  const { metrics } = context;
  const sufficient =
    metrics.postureSamples >= 30 &&
    metrics.postureVisibility !== null &&
    metrics.postureVisibility >= 0.45;
  if (!sufficient) {
    return {
      category: 'posture',
      label: CATEGORY_LABELS.posture,
      score: null,
      confidence: 0.25,
      evidenceIds: [],
      insufficientData: true,
      sampleSize: metrics.postureSamples,
      notes:
        'Chưa đủ khung hình thấy rõ cơ thể để đánh giá tư thế (cần ít nhất 30 mẫu với phần thân trên rõ). Hãy bật camera và điều chỉnh khung hình.',
    };
  }
  const visibilityScore = clamp(30 + (metrics.postureVisibility ?? 0) * 70, 20, 100);
  const stability = metrics.postureStability ?? 0.6;
  const gesture = metrics.gestureRate ?? 0;
  const stabilityScore =
    stability < 0.35 ? 55 : stability > 0.92 && gesture < 0.03 ? 68 : 90;
  const gestureScore =
    metrics.postureSamples < 45
      ? null
      : gesture >= 0.08
        ? 92
        : gesture >= 0.03
          ? 80
          : 58;
  const score = weighted([
    { score: visibilityScore, weight: 1.4 },
    { score: stabilityScore, weight: 1.1 },
    { score: gestureScore, weight: 0.9 },
  ]);
  return {
    category: 'posture',
    label: CATEGORY_LABELS.posture,
    score,
    confidence: round(clamp(0.5 + metrics.postureSamples / 300, 0.5, 0.85), 2),
    evidenceIds: [],
    insufficientData: score === null,
    sampleSize: metrics.postureSamples,
    notes: `Dựa trên ${metrics.postureSamples} mẫu MediaPipe chạy cục bộ (độ hiển thị trung bình ${Math.round((metrics.postureVisibility ?? 0) * 100)}%). Chỉ phân tích tư thế, không nhận dạng danh tính hay cảm xúc.`,
  };
}

function scoreOrganization(context: ScoreContext): CompetencyScore {
  const { metrics, phaseProgress, teacherSegments } = context;
  const sufficient = metrics.phaseCount >= 2 && (teacherSegments.length >= 3 || context.classroomEvents.length >= 3);
  if (!sufficient) {
    return {
      category: 'organization',
      label: CATEGORY_LABELS.organization,
      score: null,
      confidence: 0.3,
      evidenceIds: [],
      insufficientData: true,
      sampleSize: metrics.phaseCount,
      notes:
        'Chưa đủ bằng chứng để đánh giá tổ chức hoạt động. Cần giáo án có ít nhất 2 hoạt động và lời giảng/hoạt động lớp học tương ứng.',
    };
  }
  const coverage = metrics.phaseCount ? metrics.coveredPhaseCount / metrics.phaseCount : 0;
  let score = 30 + coverage * 60;
  if (metrics.coveredPhaseCount >= 2 && metrics.transitionCount === 0) score -= 12;
  const expectedMinutes = context.lesson.lessonPhases.reduce(
    (sum, phase) => sum + (phase.estimatedDurationMin || 0),
    0,
  );
  if (expectedMinutes > 0 && metrics.durationSec < expectedMinutes * 60 * 0.35) score -= 10;
  return {
    category: 'organization',
    label: CATEGORY_LABELS.organization,
    score: Math.round(clamp(score, 0, 100)),
    confidence: round(clamp(0.5 + coverage * 0.3, 0.5, 0.82), 2),
    evidenceIds: [],
    insufficientData: false,
    sampleSize: metrics.phaseCount,
    notes: `Đã ghi nhận bằng chứng cho ${metrics.coveredPhaseCount}/${metrics.phaseCount} hoạt động trong kế hoạch bài dạy. Việc chuyển hoạt động được suy ra từ nội dung lời giảng, không dựa trên thời gian.`,
  };
}

function scoreInteraction(context: ScoreContext): CompetencyScore {
  const { metrics, classroomEvents, teacherSegments } = context;
  const sufficient = metrics.studentTurns >= 3;
  if (!sufficient) {
    return {
      category: 'interaction',
      label: CATEGORY_LABELS.interaction,
      score: null,
      confidence: 0.3,
      evidenceIds: [],
      insufficientData: true,
      sampleSize: metrics.studentTurns,
      notes:
        'Chưa có đủ lượt tương tác với học sinh AI để đánh giá. Hãy đặt câu hỏi và mời học sinh trả lời ít nhất 3 lượt.',
    };
  }
  const turnsPerFive = metrics.studentTurns / Math.max(0.2, metrics.durationSec / 300);
  const participationScore = rangeScore(turnsPerFive, 2.5, 20, 3);
  const wrongEvents = classroomEvents.filter((event) =>
    ['WRONG_ANSWER', 'INCOMPLETE_ANSWER'].includes(event.eventType),
  );
  let supportive = 0;
  for (const event of wrongEvents) {
    const response = teacherSegments.find(
      (segment) =>
        segment.startTime >= event.timestamp && segment.startTime <= event.timestamp + 20,
    );
    if (
      response &&
      (detectEncouragement(response.text) ||
        detectPraise(response.text) ||
        /(gợi ý|thử lại|cách khác|vì sao|xem lại|đúng rồi|gần đúng)/i.test(response.text))
    ) {
      supportive += 1;
    }
  }
  const wrongHandlingScore =
    wrongEvents.length === 0 ? 78 : 45 + (supportive / wrongEvents.length) * 45;
  const handEvents = classroomEvents.filter((event) => event.eventType === 'RAISE_HAND');
  const handHandlingScore =
    handEvents.length === 0
      ? null
      : 55 +
        Math.min(
          1,
          handEvents.filter((hand) =>
            classroomEvents.some(
              (event) =>
                ['ANSWER_QUESTION', 'WRONG_ANSWER', 'INCOMPLETE_ANSWER', 'PARTICIPATE_IN_ACTIVITY'].includes(
                  event.eventType,
                ) &&
                event.studentId === hand.studentId &&
                event.timestamp >= hand.timestamp &&
                event.timestamp <= hand.timestamp + 25,
            ),
          ).length / handEvents.length,
        ) *
          40;
  const score = weighted([
    { score: participationScore, weight: 1.2 },
    { score: wrongHandlingScore, weight: 1 },
    { score: handHandlingScore, weight: 0.9 },
  ]);
  return {
    category: 'interaction',
    label: CATEGORY_LABELS.interaction,
    score,
    confidence: round(clamp(0.5 + metrics.studentTurns / 40, 0.5, 0.85), 2),
    evidenceIds: [],
    insufficientData: score === null,
    sampleSize: metrics.studentTurns,
    notes: `Dựa trên ${metrics.answerCount} lượt trả lời, ${metrics.wrongAnswerCount} câu trả lời chưa đúng và ${metrics.handRaiseCount} lượt giơ tay của học sinh AI.`,
  };
}

function scorePresentation(context: ScoreContext): CompetencyScore {
  const { metrics } = context;
  const hasSpeech = metrics.teacherSpeakingSec >= 15;
  const hasPose = metrics.postureSamples >= 20 && metrics.postureVisibility !== null;
  if (!hasSpeech && !hasPose) {
    return {
      category: 'presentation',
      label: CATEGORY_LABELS.presentation,
      score: null,
      confidence: 0.2,
      evidenceIds: [],
      insufficientData: true,
      sampleSize: 0,
      notes: 'Chưa có dữ liệu giọng nói hoặc tư thế để đánh giá tác phong trình bày.',
    };
  }
  const volumeScore =
    metrics.avgVolumeDb === null ? null : rangeScore(metrics.avgVolumeDb, -38, -12, 12);
  const paceScore = metrics.wordsPerMinute ? rangeScore(metrics.wordsPerMinute, 110, 185, 55) : null;
  const visibilityScore =
    metrics.postureVisibility === null ? null : clamp(35 + metrics.postureVisibility * 65, 20, 100);
  const score = weighted([
    { score: volumeScore, weight: 1 },
    { score: paceScore, weight: 1 },
    { score: visibilityScore, weight: 1.1 },
  ]);
  return {
    category: 'presentation',
    label: CATEGORY_LABELS.presentation,
    score,
    confidence: round(clamp(0.4 + (hasSpeech ? 0.2 : 0) + (hasPose ? 0.2 : 0), 0.4, 0.8), 2),
    evidenceIds: [],
    insufficientData: score === null,
    sampleSize: metrics.postureSamples + metrics.teacherSpeakingSec,
    notes: `Kết hợp ${hasSpeech ? 'đo giọng nói' : 'không có dữ liệu giọng'} và ${hasPose ? 'phân tích tư thế' : 'không có dữ liệu tư thế'}. Không đánh giá ngoại hình.`,
  };
}

export function buildSessionReport(input: BuildReportInput): SessionReport {
  const { session, lesson, observations, transcripts, classroomEvents, feedback } = input;
  const phaseProgress = computePhaseProgress(lesson, transcripts, classroomEvents, session.durationSec);
  const metrics = computeMetrics(session, transcripts, classroomEvents, observations, phaseProgress);
  const teacherSegments = transcripts.filter((segment) => segment.speaker === 'teacher');
  const context: ScoreContext = {
    session,
    lesson,
    metrics,
    transcripts,
    classroomEvents,
    phaseProgress,
    teacherSegments,
  };

  const competencies: CompetencyScore[] = [
    scorePedagogy(context),
    scoreVoice(context),
    scorePosture(context),
    scoreOrganization(context),
    scoreInteraction(context),
    scorePresentation(context),
  ];

  const evidence: EvidenceItem[] = feedback.map((event) => event.evidence);
  const addEvidence = (
    category: FeedbackCategory,
    source: EvidenceItem['source'],
    timestamp: number,
    observedFact: string,
    interpretation: string,
    confidence: number,
  ): string => {
    const item: EvidenceItem = {
      id: uid('evidence'),
      timestamp: Math.max(0, round(timestamp, 1)),
      source,
      observedFact,
      interpretation,
      confidence,
      sessionId: session.id,
    };
    evidence.push(item);
    const competency = competencies.find((entry) => entry.category === category);
    if (competency) competency.evidenceIds.push(item.id);
    return item.id;
  };

  const lastTeacherSegment = teacherSegments[teacherSegments.length - 1];
  const questionSegments = teacherSegments.filter((segment) => classifyQuestion(segment.text).isQuestion);
  const lastQuestion = questionSegments[questionSegments.length - 1];
  if (metrics.questionCount > 0 && lastQuestion) {
    addEvidence(
      'pedagogy',
      'transcript',
      lastQuestion.startTime,
      `Nhận dạng ${metrics.questionCount} câu hỏi, trong đó ${metrics.openQuestionCount} câu hỏi mở/gợi mở và ${metrics.closedQuestionCount} câu hỏi đóng.`,
      'Số lượng và loại câu hỏi được đếm trực tiếp từ lời giảng đã nhận dạng, không ước lượng.',
      0.8,
    );
  }
  if (metrics.praiseCount > 0) {
    const praiseSegment = [...teacherSegments].reverse().find((segment) => detectPraise(segment.text));
    if (praiseSegment) {
      addEvidence(
        'pedagogy',
        'transcript',
        praiseSegment.startTime,
        `Ghi nhận ${metrics.praiseCount} lời khen/ghi nhận tích cực trong lời giảng.`,
        'Lời khen cụ thể giúp học sinh nhận ra điều mình làm đúng.',
        0.75,
      );
    }
  }
  if (metrics.transitionCount > 0) {
    const transitionSegment = [...teacherSegments].reverse().find((segment) => detectTransition(segment.text));
    if (transitionSegment) {
      addEvidence(
        'organization',
        'transcript',
        transitionSegment.startTime,
        `Ghi nhận ${metrics.transitionCount} câu chuyển hoạt động trong lời giảng.`,
        'Câu chuyển giúp học sinh theo dõi mạch bài học.',
        0.7,
      );
    }
  }
  if (metrics.teacherSpeakingSec >= 15) {
    const audioSamples = observations.filter(isAudio);
    const lastAudio = audioSamples[audioSamples.length - 1];
    addEvidence(
      'voice',
      'audio',
      lastAudio?.timestamp ?? session.durationSec,
      `Thời gian có tiếng nói ${metrics.teacherSpeakingSec} giây trên tổng ${metrics.durationSec} giây; âm lượng trung bình ${metrics.avgVolumeDb ?? '—'} dB; ${metrics.pauseCount} khoảng lặng từ 2 giây.`,
      'Các chỉ số âm thanh là phép đo tương đối từ micro của thiết bị.',
      0.8,
    );
  }
  if (metrics.postureSamples >= 10) {
    const poseRows = observations.filter(isPose);
    const lastPose = poseRows[poseRows.length - 1];
    addEvidence(
      'posture',
      'pose',
      lastPose?.timestamp ?? session.durationSec,
      `Phân tích ${metrics.postureSamples} mẫu tư thế; độ hiển thị trung bình ${Math.round((metrics.postureVisibility ?? 0) * 100)}%; tỷ lệ mẫu có cử chỉ tay lên trên vai ${Math.round((metrics.gestureRate ?? 0) * 100)}%.`,
      'MediaPipe Pose chạy hoàn toàn trong trình duyệt; video không được gửi lên máy chủ.',
      0.8,
    );
  }
  if (phaseProgress.length) {
    const coveredPhases = phaseProgress.filter((phase) => phase.covered);
    const timestamp = coveredPhases.flatMap((phase) => phase.evidenceTimestamps).sort((a, b) => b - a)[0] ?? 0;
    addEvidence(
      'organization',
      'lesson',
      timestamp,
      `Có bằng chứng cho ${coveredPhases.length}/${phaseProgress.length} hoạt động: ${coveredPhases.map((phase) => phase.name).join('; ') || 'chưa có'}.`,
      'Mức bao phủ được suy ra từ nội dung lời giảng khớp với hoạt động trong kế hoạch bài dạy.',
      0.7,
    );
  }
  if (metrics.studentTurns > 0) {
    const lastEvent = classroomEvents[classroomEvents.length - 1];
    addEvidence(
      'interaction',
      'classroom',
      lastEvent?.timestamp ?? session.durationSec,
      `Học sinh AI có ${metrics.studentTurns} lượt tương tác, ${metrics.answerCount} lượt trả lời, ${metrics.handRaiseCount} lượt giơ tay.`,
      'Các lượt tương tác được ghi nhận từ lớp học mô phỏng, không phải học sinh thật.',
      0.85,
    );
  }

  const scored = competencies.filter((entry) => entry.score !== null) as Array<CompetencyScore & { score: number }>;
  const weights = scored.map((entry) => ({
    score: entry.score,
    weight: CATEGORY_WEIGHTS[entry.category] * entry.confidence,
  }));
  const weightedScore = weights.length
    ? Math.round(weights.reduce((sum, entry) => sum + entry.score * entry.weight, 0) / weights.reduce((sum, entry) => sum + entry.weight, 0))
    : 0;
  const confidenceSum = scored.reduce(
    (sum, entry) => sum + CATEGORY_WEIGHTS[entry.category] * entry.confidence,
    0,
  );
  const weightSum = scored.reduce((sum, entry) => sum + CATEGORY_WEIGHTS[entry.category], 0);
  const overallConfidence = weightSum > 0 ? round(confidenceSum / weightSum, 2) : 0;
  const overallScore = scored.length >= 2 && overallConfidence >= 0.45 ? weightedScore : null;

  const strengths: ReportInsight[] = [];
  for (const competency of [...scored].sort((a, b) => b.score - a.score)) {
    if (strengths.length >= 3) break;
    if (competency.score < 75 || !competency.evidenceIds.length) continue;
    strengths.push({
      title: `${competency.label}: ${competency.score}/100`,
      detail: competency.notes,
      evidenceIds: competency.evidenceIds.slice(0, 3),
      category: competency.category,
    });
  }
  if (!strengths.length) {
    const praised = feedback.find((event) => event.severity === 'info' && event.ruleId.includes('praise'));
    if (praised) {
      strengths.push({
        title: 'Điểm tích cực trong buổi tập',
        detail: praised.explanation,
        evidenceIds: [praised.evidence.id],
        category: praised.category,
      });
    }
  }

  const improvements: ReportInsight[] = [];
  for (const competency of [...scored].sort((a, b) => a.score - b.score)) {
    if (improvements.length >= 2) break;
    if (competency.score >= 72) continue;
    improvements.push({
      title: `${competency.label}: cần cải thiện (${competency.score}/100)`,
      detail: competency.notes,
      evidenceIds: competency.evidenceIds.slice(0, 3),
      category: competency.category,
    });
  }
  for (const event of feedback) {
    if (improvements.length >= 4) break;
    if (event.severity !== 'warning' && event.severity !== 'critical' && event.severity !== 'suggestion') continue;
    if (improvements.some((insight) => insight.category === event.category)) continue;
    improvements.push({
      title: event.explanation,
      detail: event.recommendation,
      evidenceIds: [event.evidence.id],
      category: event.category,
    });
  }

  const recommendations: string[] = [];
  const missing: string[] = [];
  if (competencies.find((entry) => entry.category === 'posture')?.insufficientData) {
    missing.push(
      'Bật camera và giữ phần thân trên trong khung hình để có dữ liệu tư thế ở buổi tiếp theo.',
    );
  }
  if (competencies.find((entry) => entry.category === 'voice')?.insufficientData) {
    missing.push('Bật micro ít nhất 20 giây trong lúc giảng để đánh giá giọng nói ổn định hơn.');
  }
  if (competencies.find((entry) => entry.category === 'pedagogy')?.insufficientData) {
    missing.push(
      'Sử dụng nhận dạng giọng nói hoặc nhập lời giảng thủ công để báo cáo có đủ bằng chứng ngôn ngữ sư phạm.',
    );
  }
  if (overallScore === null) {
    missing.push(
      'Chưa đủ dữ liệu để tính điểm tổng. Điểm chỉ được tính khi có ít nhất hai nhóm năng lực với dữ liệu thực tế.',
    );
  }
  recommendations.push(...missing);

  const categoryAdvice: Partial<Record<FeedbackCategory, string>> = {
    pedagogy:
      'Luyện thêm câu hỏi mở sau mỗi câu hỏi đóng: “Vì sao em biết?”, “Em có cách làm khác không?”.',
    voice:
      'Luyện nhấn giọng ở từ khóa và giữ tốc độ 120–170 từ/phút; dừng ngắn sau mỗi ý quan trọng.',
    posture:
      'Luyện đứng ổn định trong khung hình và dùng tay minh họa khi giải thích nội dung mới.',
    organization:
      'Luyện câu chuyển hoạt động rõ ràng: “Chúng ta vừa hoàn thành…, bây giờ cùng chuyển sang…”.',
    interaction:
      'Sau câu trả lời sai, hãy gợi ý từng bước thay vì chuyển ngay sang học sinh khác.',
    presentation:
      'Luyện kết hợp giọng nói và cử chỉ: đứng thoải mái, tay minh họa đúng lúc, mắt nhìn về lớp.',
  };
  for (const competency of [...scored].sort((a, b) => a.score - b.score)) {
    if (recommendations.length >= 5) break;
    if (competency.score >= 70) continue;
    const advice = categoryAdvice[competency.category];
    if (advice) recommendations.push(advice);
  }
  if (!recommendations.length) {
    recommendations.push(
      'Tiếp tục luyện với cùng bài dạy trong một buổi khác để so sánh tiến bộ dựa trên dữ liệu thực tế.',
    );
  }

  const timeline = [...evidence].sort((a, b) => a.timestamp - b.timestamp).slice(0, 60);

  return {
    id: uid('report'),
    sessionId: session.id,
    lessonPlanId: lesson.id,
    lessonTitle: lesson.title,
    createdAt: new Date().toISOString(),
    overallScore,
    overallConfidence,
    competencies,
    strengths,
    improvements,
    timeline,
    evidence,
    metrics,
    phaseProgress,
    recommendations: Array.from(new Set(recommendations)).slice(0, 6),
    generatedBy: 'rules',
    aiSummary: input.aiSummary ?? null,
    isDemo: session.isDemo,
  };
}

export function summarizeReportForAI(report: SessionReport): string {
  const lines = [
    `Bài dạy: ${report.lessonTitle}`,
    `Thời lượng: ${Math.round(report.metrics.durationSec / 60)} phút`,
    `Điểm tổng: ${report.overallScore === null ? 'chưa đủ dữ liệu' : `${report.overallScore}/100`}`,
    ...report.competencies.map(
      (competency) =>
        `- ${competency.label}: ${competency.score === null ? 'chưa đủ dữ liệu' : `${competency.score}/100`}`,
    ),
  ];
  return lines.join('\n');
}

export function competencyTone(score: number | null): 'success' | 'warning' | 'danger' | 'neutral' {
  if (score === null) return 'neutral';
  if (score >= 78) return 'success';
  if (score >= 60) return 'warning';
  return 'danger';
}
