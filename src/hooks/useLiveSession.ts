import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ClassroomEvent,
  FeedbackEvent,
  LessonPlan,
  ObservationRecord,
  PoseKeypoint,
  PostureMetrics,
  PracticeSession,
  PresentationContext,
  SessionStatus,
  StudentAvatarState,
  StudentPersona,
  TranscriptSegment,
} from '@/types/domain';
import type { AIProvider } from '@/providers/types';
import { ClassroomSimulation } from '@/services/classroom/simulation-engine';
import { FeedbackEngine, type FeedbackSnapshot } from '@/services/analysis/feedback-engine';
import { SpeechRecognizer, type SpeechStatus } from '@/services/speech/speech-recognizer';
import { lessonPhaseName } from '@/services/lesson/lesson-context';
import { observationRepo, feedbackRepo, sessionRepo, transcriptRepo } from '@/data/repositories';
import { finalizePracticeSession } from '@/services/session/session-finalizer';
import { average, clamp, round, sleep, standardDeviation, uid } from '@/lib/utils';
import { hashString } from '@/lib/rng';
import { toast } from '@/store/toast-store';

export interface LiveMicSample {
  volumeDb: number;
  speaking: boolean;
  pauseSec: number;
}

export interface LivePoseSample {
  keypoints: PoseKeypoint[];
  metrics: PostureMetrics;
  confidence: number;
}

export interface LiveMediaBridge {
  getMicSample: () => LiveMicSample | null;
  getPoseSample: () => LivePoseSample | null;
  isCameraActive: () => boolean;
  isMicActive: () => boolean;
}

interface MicSampleRow extends LiveMicSample {
  timestamp: number;
}

interface PoseSampleRow extends LivePoseSample {
  timestamp: number;
}

interface UseLiveSessionOptions {
  session: PracticeSession | null;
  lesson: LessonPlan | null;
  personas: StudentPersona[];
  provider: AIProvider;
  bridge: LiveMediaBridge;
  presentationContext?: PresentationContext | null;
}

const ACTIVE_STATUSES: SessionStatus[] = ['ready', 'active', 'paused'];

export function useLiveSession({
  session,
  lesson,
  personas,
  provider,
  bridge,
  presentationContext,
}: UseLiveSessionOptions) {
  const [status, setStatusState] = useState<SessionStatus>(session?.status ?? 'ready');
  const statusRef = useRef<SessionStatus>(session?.status ?? 'ready');
  const [elapsed, setElapsed] = useState(0);
  const [phaseId, setPhaseId] = useState<string | null>(lesson?.lessonPhases[0]?.id ?? null);
  const [states, setStates] = useState<Record<string, StudentAvatarState>>({});
  const [raisedHands, setRaisedHands] = useState<string[]>([]);
  const [events, setEvents] = useState<ClassroomEvent[]>([]);
  const [feedback, setFeedback] = useState<FeedbackEvent[]>([]);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [interim, setInterim] = useState('');
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('idle');
  const [speechMessage, setSpeechMessage] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const startAtRef = useRef(0);
  const pausedTotalRef = useRef(0);
  const pauseStartedRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const simRef = useRef<ClassroomSimulation | null>(null);
  const feedbackEngineRef = useRef<FeedbackEngine | null>(null);
  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const micSamplesRef = useRef<MicSampleRow[]>([]);
  const poseSamplesRef = useRef<PoseSampleRow[]>([]);
  const pendingObservationsRef = useRef<ObservationRecord[]>([]);
  const eventsRef = useRef<ClassroomEvent[]>([]);
  const feedbackRef = useRef<FeedbackEvent[]>([]);
  const transcriptRef = useRef<TranscriptSegment[]>([]);
  const coveredPhasesRef = useRef<Set<string>>(new Set());
  const phaseTransitionsRef = useRef(0);
  const lastSampleAtRef = useRef(0);
  const lastPoseAtRef = useRef(0);
  const lastFeedbackAtRef = useRef(0);
  const lastPersistAtRef = useRef(0);
  const lastSessionSaveAtRef = useRef(0);
  const teacherWordsRef = useRef(0);
  const totalSpeakingSecRef = useRef(0);
  const sessionRef = useRef<PracticeSession | null>(session);
  const lessonRef = useRef<LessonPlan | null>(lesson);
  const bridgeRef = useRef(bridge);
  const providerRef = useRef(provider);
  const presentationContextRef = useRef<PresentationContext | null>(presentationContext ?? null);
  const finalizedRef = useRef(false);

  sessionRef.current = session;
  lessonRef.current = lesson;
  bridgeRef.current = bridge;
  providerRef.current = provider;
  presentationContextRef.current = presentationContext ?? null;

  const setStatus = useCallback((next: SessionStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const clock = useCallback(() => {
    if (!startAtRef.current) return 0;
    const now =
      statusRef.current === 'paused' && pauseStartedRef.current
        ? pauseStartedRef.current
        : Date.now();
    return Math.max(0, (now - startAtRef.current - pausedTotalRef.current) / 1000);
  }, []);

  const addCoveredPhase = useCallback(
    (id: string | null | undefined) => {
      if (!id) return;
      if (coveredPhasesRef.current.has(id)) return;
      coveredPhasesRef.current.add(id);
    },
    [],
  );

  const addTranscript = useCallback(
    (input: Omit<TranscriptSegment, 'id' | 'sessionId'>) => {
      const current = sessionRef.current;
      if (!current) return null;
      const segment: TranscriptSegment = {
        ...input,
        id: uid('transcript'),
        sessionId: current.id,
      };
      transcriptRef.current.push(segment);
      setTranscript([...transcriptRef.current]);
      void transcriptRepo.save(segment).catch((saveError) => {
        console.warn('[Teacher Coach AI] Could not save transcript segment:', saveError);
      });
      if (segment.speaker === 'teacher') {
        teacherWordsRef.current += segment.text.split(/\s+/).filter(Boolean).length;
      }
      return segment;
    },
    [],
  );

  const pushObservation = useCallback((row: ObservationRecord) => {
    pendingObservationsRef.current.push(row);
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    recognizerRef.current?.stop();
    recognizerRef.current = null;
    setInterim('');
  }, []);

  /**
   * Starts browser speech recognition only when the session is active and the
   * microphone was explicitly enabled. Safe to call repeatedly (e.g. when the
   * teacher enables the microphone after pressing Start).
   */
  const startSpeechRecognition = useCallback(() => {
    if (statusRef.current !== 'active') return false;
    if (!bridgeRef.current.isMicActive()) return false;
    if (recognizerRef.current) return true;
    const recognizer = new SpeechRecognizer(
      {
        onInterim: (text) => setInterim(text),
        onFinal: (result) => {
          if (statusRef.current !== 'active') return;
          setInterim('');
          const text = result.text.trim();
          if (!text) return;
          addTranscript({
            startTime: round(result.startTime, 1),
            endTime: round(result.endTime, 1),
            text,
            speaker: 'teacher',
            confidence: result.confidence,
            source: 'speech',
          });
          void simRef.current?.handleTeacherUtterance(text);
        },
        onStatus: (nextStatus, message) => {
          setSpeechStatus(nextStatus);
          setSpeechMessage(message ?? null);
        },
      },
      clock,
    );
    recognizerRef.current = recognizer;
    return recognizer.start();
  }, [addTranscript, clock]);

  const flushObservations = useCallback(async () => {
    if (!pendingObservationsRef.current.length) return;
    const rows = pendingObservationsRef.current;
    pendingObservationsRef.current = [];
    try {
      await observationRepo.bulkSave(rows);
    } catch (saveError) {
      console.warn('[Teacher Coach AI] Could not save observations:', saveError);
      pendingObservationsRef.current = [...rows, ...pendingObservationsRef.current];
    }
  }, []);

  const buildFeedbackSnapshot = useCallback((): FeedbackSnapshot | null => {
    const current = sessionRef.current;
    const activeLesson = lessonRef.current;
    if (!current || !activeLesson) return null;
    const elapsedNow = clock();
    const micSamples = micSamplesRef.current;
    const speakingVolumes = micSamples.filter((row) => row.speaking).map((row) => row.volumeDb);
    let pauseRun = 0;
    let pauseCount = 0;
    let longestPause = 0;
    for (let index = 0; index < micSamples.length; index += 1) {
      const row = micSamples[index];
      const next = micSamples[index + 1];
      const interval = next ? clamp(next.timestamp - row.timestamp, 0.25, 3) : 1;
      if (!row.speaking) {
        pauseRun += interval;
        longestPause = Math.max(longestPause, pauseRun);
      } else if (pauseRun >= 2) {
        pauseCount += 1;
        pauseRun = 0;
      } else {
        pauseRun = 0;
      }
    }
    const wpm =
      totalSpeakingSecRef.current >= 8 && teacherWordsRef.current >= 15
        ? Math.round(teacherWordsRef.current / (totalSpeakingSecRef.current / 60))
        : null;
    const recentPose = poseSamplesRef.current.slice(-30);
    const poseVisibility = average(recentPose.map((row) => row.metrics.visibilityRatio));
    const poseStability = average(recentPose.map((row) => row.metrics.stability));
    const poseMovement = average(recentPose.map((row) => row.metrics.movementIntensity));
    const poseGesture = recentPose.length
      ? recentPose.filter((row) => row.metrics.wristAboveShoulderRatio >= 0.3).length / recentPose.length
      : null;
    const poseBrightness = average(
      recentPose
        .map((row) => row.metrics.brightness)
        .filter((value): value is number => typeof value === 'number'),
    );
    return {
      sessionId: current.id,
      elapsed: elapsedNow,
      transcript: transcriptRef.current,
      classroomEvents: eventsRef.current,
      audio: {
        samples: micSamples.length,
        speakingSec: totalSpeakingSecRef.current,
        avgVolumeDb: average(speakingVolumes),
        volumeStdDb: standardDeviation(speakingVolumes),
        pauseCount,
        longestPauseSec: round(longestPause, 1),
        wpm,
      },
      pose: {
        samples: recentPose.length,
        visibility: poseVisibility,
        stability: poseStability,
        movement: poseMovement,
        gestureRate: poseGesture,
        brightness: poseBrightness,
        centerOffsetX: recentPose.length ? recentPose[recentPose.length - 1].metrics.centerOffsetX : null,
      },
      phase: {
        currentName: activeLesson.lessonPhases.find((phase) => phase.id === phaseId)?.name,
        transitions: phaseTransitionsRef.current,
        covered: coveredPhasesRef.current.size,
        total: activeLesson.lessonPhases.length,
      },
      micActive: bridgeRef.current.isMicActive(),
      cameraActive: bridgeRef.current.isCameraActive(),
    };
  }, [clock, phaseId]);

  const evaluateFeedback = useCallback(() => {
    const engine = feedbackEngineRef.current;
    const snapshot = buildFeedbackSnapshot();
    if (!engine || !snapshot) return;
    if (clock() < 20) return;
    const event = engine.evaluate(snapshot);
    if (!event) return;
    feedbackRef.current.push(event);
    setFeedback([...feedbackRef.current]);
    void feedbackRepo.saveMany([event]).catch((saveError) => {
      console.warn('[Teacher Coach AI] Could not save feedback:', saveError);
    });
  }, [buildFeedbackSnapshot, clock]);

  const persistProgress = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    await flushObservations();
    const duration = Math.round(clock());
    if (duration > 0) {
      await sessionRepo
        .save({
          ...current,
          status: statusRef.current === 'ready' ? 'active' : statusRef.current,
          durationSec: duration,
          transcriptAvailable: transcriptRef.current.length > 0,
        })
        .catch((saveError) => console.warn('[Teacher Coach AI] Session autosave failed:', saveError));
    }
  }, [clock, flushObservations]);

  const tick = useCallback(() => {
    if (statusRef.current !== 'active') return;
    const now = Date.now();
    const elapsedNow = clock();
    elapsedRef.current = elapsedNow;
    setElapsed(elapsedNow);
    const current = sessionRef.current;
    const activeLesson = lessonRef.current;
    if (!current || !activeLesson) return;

    simRef.current?.tick();

    if (now - lastSampleAtRef.current >= 1000) {
      lastSampleAtRef.current = now;
      const mic = bridgeRef.current.getMicSample();
      if (mic && bridgeRef.current.isMicActive()) {
        micSamplesRef.current.push({
          timestamp: elapsedNow,
          volumeDb: mic.volumeDb,
          speaking: mic.speaking,
          pauseSec: mic.pauseSec,
        });
        if (micSamplesRef.current.length > 7200) micSamplesRef.current.shift();
        if (mic.speaking) totalSpeakingSecRef.current += 1;
        pushObservation({
          id: uid('obs'),
          sessionId: current.id,
          kind: 'audio',
          timestamp: round(elapsedNow, 1),
          volumeDb: mic.volumeDb,
          speechActivity: mic.speaking,
          pauseDurationSec: mic.pauseSec,
          confidence: 1,
        });
      }
    }

    if (now - lastPoseAtRef.current >= 2000) {
      lastPoseAtRef.current = now;
      const pose = bridgeRef.current.getPoseSample();
      if (pose && bridgeRef.current.isCameraActive()) {
        poseSamplesRef.current.push({ timestamp: elapsedNow, ...pose });
        if (poseSamplesRef.current.length > 2400) poseSamplesRef.current.shift();
        pushObservation({
          id: uid('obs'),
          sessionId: current.id,
          kind: 'pose',
          timestamp: round(elapsedNow, 1),
          keypoints: pose.keypoints,
          postureMetrics: pose.metrics,
          confidence: pose.confidence,
        });
      }
    }

    if (now - lastFeedbackAtRef.current >= 5000) {
      lastFeedbackAtRef.current = now;
      evaluateFeedback();
    }
    if (now - lastPersistAtRef.current >= 5000) {
      lastPersistAtRef.current = now;
      void flushObservations();
    }
    if (now - lastSessionSaveAtRef.current >= 10000) {
      lastSessionSaveAtRef.current = now;
      const latest = sessionRef.current;
      if (latest) {
        void sessionRepo
          .save({
            ...latest,
            status: 'active',
            durationSec: Math.round(elapsedNow),
            transcriptAvailable: transcriptRef.current.length > 0,
            poseAvailable: poseSamplesRef.current.length > 0,
            cameraAvailable: poseSamplesRef.current.length > 0,
          })
          .catch((saveError) => console.warn('[Teacher Coach AI] Session autosave failed:', saveError));
      }
    }
  }, [clock, evaluateFeedback, flushObservations, pushObservation]);

  const attachSimulation = useCallback(
    (current: PracticeSession, activeLesson: LessonPlan) => {
      const engine = new ClassroomSimulation(
        activeLesson,
        personas,
        {
          sessionId: current.id,
          mode: current.settings.mode,
          scenario: current.settings.scenario,
          difficulty: current.settings.difficulty,
          studentActivity: current.settings.studentActivity,
        },
        {
          onEvent: (event) => {
            eventsRef.current.push(event);
            setEvents([...eventsRef.current]);
            addCoveredPhase(event.lessonPhaseId);
            void import('@/data/repositories').then(({ classroomEventRepo }) =>
              classroomEventRepo.save(event).catch((saveError) => {
                console.warn('[Teacher Coach AI] Could not save classroom event:', saveError);
              }),
            );
            if (event.response) {
              addTranscript({
                startTime: round(event.timestamp, 1),
                endTime: round(event.timestamp + Math.min(12, Math.max(1.2, event.response.split(/\s+/).length * 0.34)), 1),
                text: event.response,
                speaker: 'student',
                confidence: event.confidence,
                source: 'ai',
                studentId: event.studentId,
              });
            }
          },
          onStates: (nextStates) => setStates(nextStates),
          onRaisedHands: (hands) => setRaisedHands(hands),
          onPhaseChange: (nextPhaseId, _confidence, _reason) => {
            setPhaseId(nextPhaseId);
            addCoveredPhase(nextPhaseId);
            phaseTransitionsRef.current += 1;
          },
        },
        providerRef.current,
        clock,
        hashString(current.id),
      );
      simRef.current = engine;
      engine.setPresentationContext(presentationContextRef.current);
      engine.start();
      addCoveredPhase(engine.getCurrentPhaseId());
      setPhaseId(engine.getCurrentPhaseId());
      feedbackEngineRef.current = new FeedbackEngine(current.settings.feedbackFrequency);
    },
    [addCoveredPhase, addTranscript, clock, personas],
  );

  useEffect(() => {
    simRef.current?.setPresentationContext(presentationContext ?? null);
  }, [presentationContext]);

  const start = useCallback(async () => {
    const current = sessionRef.current;
    const activeLesson = lessonRef.current;
    if (!current || !activeLesson) {
      setError('Chưa tải được kế hoạch bài dạy cho buổi luyện.');
      return false;
    }
    if (statusRef.current === 'active' || statusRef.current === 'paused') return true;
    try {
      setError(null);
      setFinalizeError(null);
      finalizedRef.current = false;
      startAtRef.current = Date.now();
      pausedTotalRef.current = 0;
      pauseStartedRef.current = null;
      lastSampleAtRef.current = 0;
      lastPoseAtRef.current = 0;
      lastFeedbackAtRef.current = 0;
      lastPersistAtRef.current = 0;
      lastSessionSaveAtRef.current = 0;
      setStatus('active');
      const startedAt = new Date().toISOString();
      const updated = { ...current, status: 'active' as const, startedAt, durationSec: 0 };
      sessionRef.current = updated;
      await sessionRepo.save(updated);
      attachSimulation(updated, activeLesson);
      if (bridgeRef.current.isMicActive()) {
        startSpeechRecognition();
      } else {
        setSpeechStatus('idle');
        setSpeechMessage('Micro chưa bật — bạn có thể nhập lời giảng thủ công trong ô phía dưới.');
      }
      tickRef.current = window.setInterval(tick, 500);
      return true;
    } catch (startError) {
      console.error('[Teacher Coach AI] Could not start session:', startError);
      setError('Không thể bắt đầu buổi luyện. Kiểm tra dữ liệu bài dạy rồi thử lại.');
      setStatus('ready');
      return false;
    }
  }, [attachSimulation, clock, setStatus, startSpeechRecognition, tick]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'active') return;
    pauseStartedRef.current = Date.now();
    simRef.current?.pause();
    stopSpeechRecognition();
    setStatus('paused');
    setInterim('');
    const current = sessionRef.current;
    if (current) {
      void sessionRepo.save({
        ...current,
        status: 'paused',
        durationSec: Math.round(clock()),
        transcriptAvailable: transcriptRef.current.length > 0,
      });
    }
  }, [clock, setStatus, stopSpeechRecognition]);

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return;
    if (pauseStartedRef.current) {
      pausedTotalRef.current += Date.now() - pauseStartedRef.current;
      pauseStartedRef.current = null;
    }
    simRef.current?.resume();
    setStatus('active');
    const current = sessionRef.current;
    if (current) void sessionRepo.save({ ...current, status: 'active' });
    if (bridgeRef.current.isMicActive()) {
      startSpeechRecognition();
    }
  }, [clock, setStatus, startSpeechRecognition]);

  const submitTeacherText = useCallback(
    (rawText: string, source: 'manual' | 'speech' = 'manual') => {
      if (statusRef.current !== 'active') {
        toast.warning('Buổi luyện chưa hoạt động', 'Hãy bắt đầu buổi luyện trước khi nhập lời giảng.');
        return false;
      }
      const text = rawText.replace(/\s+/g, ' ').trim();
      if (!text) return false;
      const startTime = round(clock(), 1);
      const estimated = Math.min(25, Math.max(1.2, text.split(/\s+/).length * 0.38));
      addTranscript({
        startTime,
        endTime: round(startTime + estimated, 1),
        text,
        speaker: 'teacher',
        confidence: source === 'manual' ? 1 : 0.7,
        source,
      });
      setInterim('');
      void simRef.current?.handleTeacherUtterance(text);
      return true;
    },
    [addTranscript, clock],
  );

  const end = useCallback(async (): Promise<string | null> => {
    const current = sessionRef.current;
    const activeLesson = lessonRef.current;
    if (!current || !activeLesson) return null;
    if (finalizedRef.current) return current.reportId ?? null;
    setFinalizing(true);
    setError(null);
    setFinalizeError(null);
    try {
      const duration = Math.max(1, Math.round(clock()));
      stopSpeechRecognition();
      simRef.current?.stop();
      if (tickRef.current !== null) window.clearInterval(tickRef.current);
      tickRef.current = null;
      setInterim('');
      setStatus('completed');
      await flushObservations();
      const endedAt = new Date().toISOString();
      const updated: PracticeSession = {
        ...current,
        status: 'completed',
        endedAt,
        durationSec: duration,
        transcriptAvailable: transcriptRef.current.length > 0,
        cameraAvailable: poseSamplesRef.current.length > 0,
        poseAvailable: poseSamplesRef.current.length > 0,
      };
      sessionRef.current = updated;
      await sessionRepo.save(updated);
      // Let pending writes settle before reading everything back for the report.
      await sleep(120);
      const result = await finalizePracticeSession({
        sessionId: current.id,
        lesson: activeLesson,
        provider: providerRef.current,
        allowAiSummary: true,
      });
      finalizedRef.current = true;
      sessionRef.current = result.session;
      setStatus('completed');
      return result.report.id;
    } catch (endError) {
      console.error('[Teacher Coach AI] Could not finalize session:', endError);
      const message = 'Buổi luyện đã được lưu nhưng chưa tạo được báo cáo. Bạn có thể thử tạo lại báo cáo từ dữ liệu đã lưu.';
      setFinalizeError(message);
      setError(message);
      setStatus('completed');
      return null;
    } finally {
      setFinalizing(false);
    }
  }, [clock, flushObservations, setStatus, stopSpeechRecognition]);

  const retryFinalize = useCallback(async (): Promise<string | null> => {
    const current = sessionRef.current;
    const activeLesson = lessonRef.current;
    if (!current || !activeLesson) return null;
    setFinalizing(true);
    setFinalizeError(null);
    try {
      const result = await finalizePracticeSession({
        sessionId: current.id,
        lesson: activeLesson,
        provider: providerRef.current,
        allowAiSummary: true,
      });
      finalizedRef.current = true;
      sessionRef.current = result.session;
      return result.report.id;
    } catch (finalizeFailure) {
      console.error('[Teacher Coach AI] Retry finalize failed:', finalizeFailure);
      setFinalizeError('Vẫn chưa tạo được báo cáo. Dữ liệu buổi luyện vẫn được giữ trong IndexedDB.');
      return null;
    } finally {
      setFinalizing(false);
    }
  }, []);

  const callStudent = useCallback((studentId: string) => {
    if (statusRef.current !== 'active') return;
    simRef.current?.callStudent(studentId);
  }, []);

  const setPhaseManually = useCallback(
    (nextPhaseId: string | null) => {
      if (!simRef.current) return;
      simRef.current.setPhaseManually(nextPhaseId);
      setPhaseId(nextPhaseId);
      addCoveredPhase(nextPhaseId);
    },
    [addCoveredPhase],
  );

  const updateFeedback = useCallback((next: FeedbackEvent) => {
    feedbackRef.current = feedbackRef.current.map((entry) => (entry.id === next.id ? next : entry));
    setFeedback([...feedbackRef.current]);
    void feedbackRepo.update(next).catch((saveError) => {
      console.warn('[Teacher Coach AI] Could not update feedback:', saveError);
    });
  }, []);

  const pinFeedback = useCallback(
    (event: FeedbackEvent) => updateFeedback({ ...event, pinned: !event.pinned }),
    [updateFeedback],
  );
  const dismissFeedback = useCallback(
    (event: FeedbackEvent) => updateFeedback({ ...event, dismissed: true }),
    [updateFeedback],
  );
  const rateFeedback = useCallback(
    (event: FeedbackEvent, helpful: boolean) => updateFeedback({ ...event, helpful }),
    [updateFeedback],
  );

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (statusRef.current !== 'active' && statusRef.current !== 'paused') return;
      event.preventDefault();
      event.returnValue = 'Buổi luyện đang diễn ra. Dữ liệu đã ghi sẽ được giữ lại nhưng phiên sẽ bị gián đoạn.';
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void flushObservations();
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [flushObservations]);

  useEffect(() => {
    return () => {
      if (tickRef.current !== null) window.clearInterval(tickRef.current);
      recognizerRef.current?.stop();
      recognizerRef.current = null;
    };
  }, []);

  const phaseName = lesson ? lessonPhaseName(lesson, phaseId) : null;

  return {
    status,
    active: status === 'active',
    paused: status === 'paused',
    elapsed,
    phaseId,
    phaseName,
    states,
    raisedHands,
    events,
    feedback,
    transcript,
    interim,
    speechStatus,
    speechMessage,
    finalizing,
    error,
    finalizeError,
    startingBlocked: !ACTIVE_STATUSES.includes(status) && status !== 'completed' && status !== 'error',
    start,
    pause,
    resume,
    end,
    retryFinalize,
    startSpeechRecognition,
    stopSpeechRecognition,
    submitTeacherText,
    callStudent,
    setPhaseManually,
    pinFeedback,
    dismissFeedback,
    rateFeedback,
  };
}
