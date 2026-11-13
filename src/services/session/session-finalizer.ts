import type { AIProvider } from '@/providers/types';
import type { LessonPlan, PracticeSession, SessionReport, TrainingResult } from '@/types/domain';
import {
  classroomEventRepo,
  feedbackRepo,
  observationRepo,
  reportRepo,
  sessionRepo,
  trainingRepo,
  transcriptRepo,
} from '@/data/repositories';
import { buildSessionReport } from '@/services/analysis/report-builder';
import { getTrainingExercise } from '@/data/training-exercises';
import { buildTrainingResult } from '@/services/training/evaluate-training';

export interface FinalizeSessionOptions {
  sessionId: string;
  lesson: LessonPlan;
  provider?: AIProvider | null;
  /** Use Gemini for the optional natural-language summary when available. */
  allowAiSummary?: boolean;
}

/**
 * Builds and persists the evidence-based report from data already saved in
 * IndexedDB. It is safe to run after a crash or page reload, so a session is
 * never silently lost.
 */
export async function finalizePracticeSession({
  sessionId,
  lesson,
  provider,
  allowAiSummary = true,
}: FinalizeSessionOptions): Promise<{
  session: PracticeSession;
  report: SessionReport;
  trainingResult: TrainingResult | null;
}> {
  const session = await sessionRepo.get(sessionId);
  if (!session) throw new Error('Không tìm thấy buổi luyện tập.');
  const [observations, transcripts, classroomEvents, feedback, existingReport] = await Promise.all([
    observationRepo.forSession(sessionId),
    transcriptRepo.forSession(sessionId),
    classroomEventRepo.forSession(sessionId),
    feedbackRepo.forSession(sessionId),
    reportRepo.forSession(sessionId),
  ]);

  const endedAt = session.endedAt ?? new Date().toISOString();
  const startMs = new Date(session.startedAt).getTime();
  const endMs = new Date(endedAt).getTime();
  const wallDuration = Number.isFinite(startMs) && Number.isFinite(endMs) ? (endMs - startMs) / 1000 : 0;
  // A session left ACTIVE/PAUSED after a reload or crash has no reliable end
  // timestamp. Use the duration persisted by the live autosave instead of
  // counting all the wall-clock time that passed while the page was closed.
  const wasInterrupted = session.status === 'active' || session.status === 'paused';
  const durationSec = wasInterrupted
    ? Math.max(session.durationSec, 0)
    : Math.max(session.durationSec, Math.round(wallDuration), 0);

  const updatedSession: PracticeSession = {
    ...session,
    status: 'completed',
    endedAt,
    durationSec,
    transcriptAvailable: transcripts.length > 0,
    cameraAvailable: observations.some((row) => row.kind === 'pose'),
    poseAvailable: observations.some((row) => row.kind === 'pose'),
  };

  const report = buildSessionReport({
    session: updatedSession,
    lesson,
    observations,
    transcripts,
    classroomEvents,
    feedback,
  });

  if (provider?.id === 'gemini' && allowAiSummary) {
    const summary = await provider.summarizeSession(updatedSession, report, transcripts).catch(() => null);
    if (summary) report.aiSummary = summary;
  }

  if (existingReport) {
    report.id = existingReport.id;
    report.createdAt = existingReport.createdAt;
  }

  const exercise = getTrainingExercise(updatedSession.trainingExerciseId);
  let trainingResult: TrainingResult | null = null;
  if (exercise) {
    const existingTraining = await trainingRepo
      .list()
      .then((rows) => rows.find((row) => row.sessionId === sessionId));
    trainingResult = buildTrainingResult(
      exercise,
      report,
      transcripts,
      classroomEvents,
      session.startedAt,
      endedAt,
    );
    if (existingTraining) trainingResult.id = existingTraining.id;
    trainingResult.isDemo = report.isDemo;
  }

  updatedSession.reportId = report.id;
  await reportRepo.save(report);
  await sessionRepo.save(updatedSession);
  if (trainingResult) await trainingRepo.save(trainingResult);
  return { session: updatedSession, report, trainingResult };
}

/**
 * Creates a fresh session record. The live page only moves it to ACTIVE after
 * the teacher explicitly presses Start.
 */
export async function createPracticeSession(params: {
  lesson: LessonPlan;
  settings: PracticeSession['settings'];
  trainingExerciseId?: string;
}): Promise<PracticeSession> {
  const { uid } = await import('@/lib/utils');
  const session: PracticeSession = {
    id: uid('session'),
    lessonPlanId: params.lesson.id,
    lessonTitle: params.lesson.title,
    mode: params.settings.mode,
    startedAt: new Date().toISOString(),
    durationSec: 0,
    status: 'ready',
    settings: params.settings,
    transcriptAvailable: false,
    cameraAvailable: false,
    poseAvailable: false,
    trainingExerciseId: params.trainingExerciseId,
    className: `Lớp ${params.lesson.grade}A`,
    isDemo: params.lesson.isDemo === true,
  };
  await sessionRepo.save(session);
  return session;
}
