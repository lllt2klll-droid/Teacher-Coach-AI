import type {
  ClassroomEvent,
  SessionReport,
  TrainingCriterion,
  TrainingCriterionResult,
  TrainingExercise,
  TranscriptSegment,
} from '@/types/domain';
import { detectEncouragement, detectPraise } from '@/services/nlp/vietnamese';
import { uid } from '@/lib/utils';

const RATIO_METRICS = new Set<TrainingCriterion['metric']>([
  'speaking_ratio',
  'posture_visibility',
  'posture_stability',
  'gesture_rate',
  'phase_coverage',
  'wrong_answer_support',
]);

const BOOLEAN_METRICS = new Set<TrainingCriterion['metric']>(['greeting_detected', 'summary_detected']);

export function formatCriterionTarget(criterion: TrainingCriterion): string {
  const formatValue = (value: number) => {
    if (RATIO_METRICS.has(criterion.metric)) return `${Math.round(value * 100)}%`;
    if (BOOLEAN_METRICS.has(criterion.metric)) return 'Có';
    if (criterion.metric === 'duration') return `${Math.round(value)} giây`;
    if (criterion.metric === 'volume_stability') return `${value} dB`;
    return `${value} ${criterion.unit}`.trim();
  };
  if (criterion.comparison === 'gte') return `≥ ${formatValue(criterion.target)}`;
  if (criterion.comparison === 'lte') return `≤ ${formatValue(criterion.target)}`;
  return `${formatValue(criterion.target)} – ${formatValue(criterion.secondTarget ?? criterion.target)}`;
}

export function formatCriterionObserved(criterion: TrainingCriterion, value: number | null): string {
  if (value === null) return 'Chưa đủ dữ liệu';
  if (RATIO_METRICS.has(criterion.metric)) return `${Math.round(value * 100)}%`;
  if (BOOLEAN_METRICS.has(criterion.metric)) return value >= 1 ? 'Có' : 'Không';
  if (criterion.metric === 'duration') return `${Math.round(value)} giây`;
  if (criterion.metric === 'volume_stability') return `${value.toFixed(1)} dB`;
  return `${Math.round(value * 10) / 10} ${criterion.unit}`.trim();
}

function greetingDetected(transcripts: TranscriptSegment[]): number | null {
  const teacher = transcripts.filter((segment) => segment.speaker === 'teacher');
  if (!teacher.length) return null;
  return teacher.some((segment) =>
    /(xin chào|chào các em|chào lớp|chúng ta bắt đầu|hôm nay chúng ta|bài học hôm nay)/i.test(
      segment.text,
    ),
  )
    ? 1
    : 0;
}

function summaryDetected(transcripts: TranscriptSegment[]): number | null {
  const teacher = transcripts.filter((segment) => segment.speaker === 'teacher');
  if (!teacher.length) return null;
  return teacher.some((segment) =>
    /(tổng kết|củng cố|nhắc lại|bài học hôm nay|dặn dò|về nhà)/i.test(segment.text),
  )
    ? 1
    : 0;
}

function wrongAnswerSupport(
  transcripts: TranscriptSegment[],
  classroomEvents: ClassroomEvent[],
): number | null {
  const wrong = classroomEvents.filter((event) =>
    ['WRONG_ANSWER', 'INCOMPLETE_ANSWER'].includes(event.eventType),
  );
  if (!wrong.length) return null;
  const teacher = transcripts.filter((segment) => segment.speaker === 'teacher');
  let supported = 0;
  for (const event of wrong) {
    const response = teacher.find(
      (segment) =>
        segment.startTime >= event.timestamp - 0.5 && segment.startTime <= event.timestamp + 25,
    );
    if (
      response &&
      (detectEncouragement(response.text) ||
        detectPraise(response.text) ||
        /(gợi ý|thử lại|cách khác|vì sao|con nghĩ|em nghĩ|xem lại|đúng rồi|gần đúng|từ từ)/i.test(
          response.text,
        ))
    ) {
      supported += 1;
    }
  }
  return supported / wrong.length;
}

function observedValue(
  criterion: TrainingCriterion,
  report: SessionReport,
  transcripts: TranscriptSegment[],
  classroomEvents: ClassroomEvent[],
): number | null {
  const { metrics } = report;
  switch (criterion.metric) {
    case 'speaking_ratio':
      return metrics.speechRatio;
    case 'volume_stability':
      return metrics.volumeVariabilityDb;
    case 'pause_appropriateness':
      return metrics.pauseCount;
    case 'posture_visibility':
      return metrics.postureVisibility;
    case 'posture_stability':
      return metrics.postureStability;
    case 'gesture_rate':
      return metrics.gestureRate;
    case 'question_count':
      return metrics.questionCount;
    case 'open_question_count':
      return metrics.openQuestionCount;
    case 'praise_count':
      return metrics.praiseCount;
    case 'encouragement_count':
      return metrics.encouragementCount;
    case 'student_turns':
      return metrics.studentTurns;
    case 'transition_count':
      return metrics.transitionCount;
    case 'phase_coverage':
      return metrics.phaseCount > 0 ? metrics.coveredPhaseCount / metrics.phaseCount : null;
    case 'greeting_detected':
      return greetingDetected(transcripts);
    case 'summary_detected':
      return summaryDetected(transcripts);
    case 'wrong_answer_support':
      return wrongAnswerSupport(transcripts, classroomEvents);
    case 'duration':
      return metrics.durationSec;
    case 'custom':
    default:
      return null;
  }
}

export function evaluateTrainingExercise(
  exercise: TrainingExercise,
  report: SessionReport,
  transcripts: TranscriptSegment[],
  classroomEvents: ClassroomEvent[],
): {
  criteriaResults: TrainingCriterionResult[];
  score: number | null;
  passed: boolean | null;
} {
  const criteriaResults: TrainingCriterionResult[] = exercise.criteria.map((criterion) => {
    const observed = observedValue(criterion, report, transcripts, classroomEvents);
    let met: boolean | null = null;
    if (observed !== null && Number.isFinite(observed)) {
      if (criterion.comparison === 'gte') met = observed >= criterion.target;
      else if (criterion.comparison === 'lte') met = observed <= criterion.target;
      else {
        const upper = criterion.secondTarget ?? criterion.target;
        met = observed >= Math.min(criterion.target, upper) && observed <= Math.max(criterion.target, upper);
      }
    }
    return {
      criterionId: criterion.id,
      label: criterion.label,
      met,
      observed,
      target: formatCriterionTarget(criterion),
    };
  });
  const evaluated = criteriaResults.filter((result) => result.met !== null);
  const met = evaluated.filter((result) => result.met === true).length;
  const failed = evaluated.some((result) => result.met === false);
  const missing = criteriaResults.some((result) => result.met === null);
  const score = evaluated.length ? Math.round((met / evaluated.length) * 100) : null;
  const passed = failed ? false : missing ? null : evaluated.length ? true : null;
  return { criteriaResults, score, passed };
}

export function buildTrainingResult(
  exercise: TrainingExercise,
  report: SessionReport,
  transcripts: TranscriptSegment[],
  classroomEvents: ClassroomEvent[],
  startedAt: string,
  completedAt: string,
) {
  const evaluation = evaluateTrainingExercise(exercise, report, transcripts, classroomEvents);
  return {
    id: uid('training'),
    exerciseId: exercise.id,
    exerciseTitle: exercise.title,
    startedAt,
    completedAt,
    durationSec: report.metrics.durationSec,
    sessionId: report.sessionId,
    score: evaluation.score,
    passed: evaluation.passed,
    criteriaResults: evaluation.criteriaResults,
    isDemo: report.isDemo,
  };
}
