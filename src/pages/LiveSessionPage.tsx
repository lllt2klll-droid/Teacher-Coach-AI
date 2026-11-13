import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  ExternalLink,
  FileUp,
  FileWarning,
  Hand,
  LayoutGrid,
  Lightbulb,
  Mic,
  MicOff,
  MonitorPlay,
  MonitorUp,
  Pause,
  Play,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  UsersRound,
  Video,
  Wand2,
} from 'lucide-react';
import {
  Badge,
  EmptyState,
  GlassCard,
  LoadingState,
  SectionHeader,
} from '@/components/ui/Display';
import { Button } from '@/components/ui/Button';
import { Select, Switch, Textarea } from '@/components/ui/Inputs';
import { ConfirmDialog, InfoNote, Modal } from '@/components/ui/Overlay';
import { Tabs } from '@/components/ui/Tabs';
import { Logo } from '@/components/brand/Logo';
import { StudentCard } from '@/components/classroom/StudentCard';
import { FeedbackCard } from '@/components/classroom/FeedbackCard';
import { TeacherCameraView } from '@/components/media/TeacherCameraView';
import { PresentationUploadCard } from '@/components/presentation/PresentationUploadCard';
import { SlideViewer } from '@/components/presentation/SlideViewer';
import { useCamera } from '@/hooks/useCamera';
import { useMicrophone } from '@/hooks/useMicrophone';
import { usePoseAnalysis } from '@/hooks/usePoseAnalysis';
import { useSessionRecording } from '@/hooks/useSessionRecording';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useLiveSession, type LiveMediaBridge } from '@/hooks/useLiveSession';
import { createAIProvider } from '@/providers';
import {
  lessonRepo,
  presentationRepo,
  reportRepo,
  sessionRepo,
  studentRepo,
} from '@/data/repositories';
import { finalizePracticeSession } from '@/services/session/session-finalizer';
import { buildPresentationContext, currentSlideIndex } from '@/services/presentation/presentation-context';
import { suggestSlideForPhase } from '@/services/presentation/slide-suggestions';
import {
  presentationChannelName,
  type PresentationChannelMessage,
} from '@/services/presentation/channel';
import { useSettingsStore } from '@/store/settings-store';
import { useGeminiApiKey } from '@/store/gemini-key-store';
import { toast } from '@/store/toast-store';
import type {
  ClassroomEvent,
  FeedbackEvent,
  PracticeSession,
  PresentationLayout,
  StudentPersona,
} from '@/types/domain';
import {
  MODE_LABELS,
  PRESENTATION_LAYOUT_HINTS,
  PRESENTATION_LAYOUT_LABELS,
  SCENARIO_LABELS,
  formatClock,
  formatDate,
  formatRelative,
  formatTimestamp,
} from '@/lib/format';
import { cn } from '@/lib/utils';

const EVENT_LABELS: Record<ClassroomEvent['eventType'], string> = {
  RAISE_HAND: 'Giơ tay',
  ANSWER_QUESTION: 'Trả lời',
  ASK_QUESTION: 'Hỏi lại',
  WRONG_ANSWER: 'Trả lời sai',
  INCOMPLETE_ANSWER: 'Trả lời chưa đủ',
  NEED_HELP: 'Cần giúp',
  DISTRACTED: 'Mất tập trung',
  REQUEST_EXPLANATION: 'Xin giải thích',
  COMPLETE_EXERCISE: 'Làm xong bài',
  PARTICIPATE_IN_ACTIVITY: 'Tham gia hoạt động',
};

function micLabel(state: string): { text: string; tone: 'neutral' | 'success' | 'warning' | 'danger' } {
  switch (state) {
    case 'requesting':
      return { text: 'Đang xin quyền…', tone: 'warning' };
    case 'ready':
      return { text: 'Micro đang bật', tone: 'success' };
    case 'denied':
      return { text: 'Bị từ chối quyền micro', tone: 'danger' };
    case 'unavailable':
      return { text: 'Không tìm thấy micro', tone: 'warning' };
    case 'error':
      return { text: 'Lỗi micro', tone: 'danger' };
    default:
      return { text: 'Micro đang tắt', tone: 'neutral' };
  }
}

function cameraLabel(state: string): { text: string; tone: 'neutral' | 'success' | 'warning' | 'danger' } {
  switch (state) {
    case 'requesting':
      return { text: 'Đang xin quyền…', tone: 'warning' };
    case 'ready':
      return { text: 'Camera đang bật', tone: 'success' };
    case 'denied':
      return { text: 'Bị từ chối quyền camera', tone: 'danger' };
    case 'unavailable':
      return { text: 'Không tìm thấy camera', tone: 'warning' };
    case 'error':
      return { text: 'Lỗi camera', tone: 'danger' };
    default:
      return { text: 'Camera đang tắt', tone: 'neutral' };
  }
}

function StatusPill({
  icon,
  label,
  tone = 'neutral',
}: {
  icon: ReactNode;
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-[var(--surface-muted)] text-[var(--text-2)]',
    success: 'bg-[var(--success-soft)] text-[var(--success)]',
    warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
    danger: 'bg-[var(--danger-soft)] text-[var(--danger)]',
    accent: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold', tones[tone])}>
      {icon}
      {label}
    </span>
  );
}

export function LiveSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const settings = useSettingsStore();
  usePageTitle('Phòng luyện tập');

  const sessionResult = useLiveQuery(async () => {
    if (!sessionId) return { session: null };
    const session = await sessionRepo.get(sessionId);
    return { session: session ?? null };
  }, [sessionId]);
  const session = sessionResult?.session ?? null;
  const lesson = useLiveQuery(
    () => (session ? lessonRepo.get(session.lessonPlanId) : Promise.resolve(null)),
    [session?.lessonPlanId],
  );
  const allPersonas = useLiveQuery(() => studentRepo.list(), []);
  const report = useLiveQuery(
    () => (sessionId ? reportRepo.forSession(sessionId) : Promise.resolve(undefined)),
    [sessionId],
  );
  const presentation = useLiveQuery(
    () => (session ? presentationRepo.forLesson(session.lessonPlanId) : Promise.resolve(undefined)),
    [session?.lessonPlanId],
  );
  const geminiApiKey = useGeminiApiKey();

  const provider = useMemo(
    () =>
      createAIProvider({
        kind: settings.aiProvider,
        endpoint: settings.aiEndpoint,
        model: settings.aiModel,
        apiKey: geminiApiKey,
      }),
    [geminiApiKey, settings.aiEndpoint, settings.aiModel, settings.aiProvider],
  );

  const simPersonas = useMemo<StudentPersona[]>(() => {
    if (!session || !allPersonas) return [];
    return allPersonas
      .filter((student) => student.isDemo !== true)
      .slice(0, Math.max(1, session.settings.studentCount));
  }, [allPersonas, session]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const camera = useCamera(videoRef);
  const mic = useMicrophone();
  const pose = usePoseAnalysis(videoRef, overlayRef, camera.state === 'ready');
  const recording = useSessionRecording();

  const micRef = useRef(mic);
  micRef.current = mic;
  const poseRef = useRef(pose);
  poseRef.current = pose;
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const bridge = useMemo<LiveMediaBridge>(
    () => ({
      getMicSample: () => {
        const current = micRef.current;
        if (current.state !== 'ready') return null;
        return {
          volumeDb: current.volumeDb,
          speaking: current.speaking,
          pauseSec: current.pauseSec,
        };
      },
      getPoseSample: () => {
        const frame = poseRef.current.getLatest();
        if (!frame) return null;
        return { keypoints: frame.keypoints, metrics: frame.metrics, confidence: frame.confidence };
      },
      isCameraActive: () => cameraRef.current.state === 'ready',
      isMicActive: () => micRef.current.state === 'ready',
    }),
    [],
  );

  const [slideIndex, setSlideIndex] = useState(0);
  const [stageTab, setStageTab] = useState<'camera' | 'slide'>('camera');
  const [presentationModalOpen, setPresentationModalOpen] = useState(false);
  const [presentationWindowOpen, setPresentationWindowOpen] = useState(false);
  const presentationWindowRef = useRef<Window | null>(null);
  const presentationChannelRef = useRef<BroadcastChannel | null>(null);
  const slideIndexRef = useRef(0);
  slideIndexRef.current = slideIndex;

  const presentationSlideCount = presentation?.slides.length ?? 0;
  const safeSlideIndex = presentationSlideCount
    ? Math.max(0, Math.min(presentationSlideCount - 1, slideIndex))
    : 0;
  const presentationContext = useMemo(
    () => buildPresentationContext(presentation, safeSlideIndex),
    [presentation, safeSlideIndex],
  );

  const live = useLiveSession({
    session,
    lesson: lesson ?? null,
    personas: simPersonas,
    provider,
    bridge,
    presentationContext,
  });

  const [tab, setTab] = useState('class');
  const [manualText, setManualText] = useState('');
  const [endOpen, setEndOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [finalizingStored, setFinalizingStored] = useState(false);
  const [storedError, setStoredError] = useState<string | null>(null);
  const [recordEnabled, setRecordEnabled] = useState(session?.settings.recordingEnabled ?? false);
  const recordingStartedRef = useRef(false);
  const initialSessionRef = useRef<PracticeSession | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  if (session && !initialSessionRef.current) initialSessionRef.current = session;

  useEffect(() => {
    if (!session) return;
    setRecordEnabled(session.settings.recordingEnabled);
  }, [session?.id]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [live.transcript.length, live.interim]);

  // Recording starts only once the session is explicitly active, and only if
  // the teacher enabled it. The combined stream stays on this device.
  useEffect(() => {
    if (!session || !live.active || !recordEnabled || recordingStartedRef.current) return;
    const tracks = [
      ...(camera.stream?.getVideoTracks() ?? []),
      ...(mic.stream?.getAudioTracks() ?? []),
    ];
    if (!tracks.length) return;
    recordingStartedRef.current = true;
    const combined = new MediaStream(tracks);
    const started = recording.start(combined, session.id);
    if (started) {
      toast.info('Đã bắt đầu ghi cục bộ', 'Bản ghi chỉ lưu trên thiết bị này và không được tải lên.');
    }
  }, [camera.stream, live.active, mic.stream, recordEnabled, recording, session]);

  useEffect(() => {
    if (!presentationSlideCount) {
      setSlideIndex(0);
      return;
    }
    setSlideIndex((current) => Math.max(0, Math.min(presentationSlideCount - 1, current)));
  }, [presentationSlideCount]);

  useEffect(() => {
    if (!session || !presentation || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(presentationChannelName(session.lessonPlanId));
    presentationChannelRef.current = channel;
    channel.onmessage = (event: MessageEvent<PresentationChannelMessage>) => {
      const message = event.data;
      if (!message || typeof message !== 'object') return;
      if (message.type === 'navigate' && Number.isFinite(message.index)) {
        setSlideIndex(currentSlideIndex(presentationSlideCount, message.index));
      } else if (message.type === 'request-state' && presentationSlideCount > 0) {
        channel.postMessage({
          type: 'slide',
          index: slideIndexRef.current,
          total: presentationSlideCount,
        });
      }
    };
    channel.postMessage({ type: 'slide', index: slideIndexRef.current, total: presentationSlideCount });
    return () => {
      channel.close();
      presentationChannelRef.current = null;
    };
  }, [presentation, presentationSlideCount, session]);

  useEffect(() => {
    if (!presentation || !presentationChannelRef.current) return;
    presentationChannelRef.current.postMessage({
      type: 'slide',
      index: safeSlideIndex,
      total: presentationSlideCount,
    });
  }, [presentation, presentationSlideCount, safeSlideIndex]);

  useEffect(() => {
    if (settings.presentationLayout !== 'window' || !presentation) return;
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        setSlideIndex((current) => currentSlideIndex(presentationSlideCount, current + 1));
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        setSlideIndex((current) => currentSlideIndex(presentationSlideCount, current - 1));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [presentation, presentationSlideCount, settings.presentationLayout]);

  useEffect(() => {
    if (!presentationWindowOpen) return;
    const timer = window.setInterval(() => {
      const popup = presentationWindowRef.current;
      if (!popup || popup.closed) {
        presentationWindowRef.current = null;
        setPresentationWindowOpen(false);
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [presentationWindowOpen]);

  useEffect(() => {
    if (report && session?.status === 'completed') {
      navigate(`/reports/${report.id}`, { replace: true });
    }
  }, [navigate, report, session?.status]);

  const initialSession = initialSessionRef.current;
  const interruptedOnLoad =
    Boolean(initialSession) &&
    (initialSession?.status === 'active' || initialSession?.status === 'paused');
  const completedOnLoad = initialSession?.status === 'completed';
  const loading = sessionResult === undefined || lesson === undefined || allPersonas === undefined;

  const visibleFeedback = useMemo(
    () =>
      live.feedback
        .filter((event) => !event.dismissed)
        .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.timestamp - a.timestamp),
    [live.feedback],
  );

  const personaById = useMemo(() => {
    const map = new Map<string, StudentPersona>();
    for (const persona of simPersonas) map.set(persona.id, persona);
    return map;
  }, [simPersonas]);

  const raisedPersonas = live.raisedHands
    .map((id) => personaById.get(id))
    .filter((persona): persona is StudentPersona => Boolean(persona));

  const activePhaseForSlide = useMemo(
    () => lesson?.lessonPhases.find((phase) => phase.id === live.phaseId) ?? null,
    [lesson, live.phaseId],
  );
  const slideSuggestion = useMemo(
    () => suggestSlideForPhase(presentation, activePhaseForSlide),
    [activePhaseForSlide, presentation],
  );

  const teacherSegments = live.transcript.filter((segment) => segment.speaker === 'teacher').length;
  const totalSegments = live.transcript.length;
  const phases = lesson?.lessonPhases ?? [];
  const phaseIndex = phases.findIndex((phase) => phase.id === live.phaseId);

  const openPresentationWindow = () => {
    if (!session || !presentation) {
      toast.warning('Chưa có bài trình chiếu', 'Hãy tải file PPTX trước khi mở cửa sổ trình chiếu.');
      return;
    }
    const existing = presentationWindowRef.current;
    if (existing && !existing.closed) {
      existing.focus();
      return;
    }
    const url = `${window.location.origin}/presentation/${encodeURIComponent(session.lessonPlanId)}`;
    const popup = window.open(
      url,
      `teacher-coach-presentation-${session.lessonPlanId}`,
      'popup=yes,width=1280,height=760',
    );
    if (!popup) {
      toast.warning(
        'Trình duyệt đã chặn cửa sổ trình chiếu',
        'Hãy cho phép popup cho trang này, hoặc dùng một trong các bố cục slide ngay trong phòng luyện.',
      );
      return;
    }
    presentationWindowRef.current = popup;
    setPresentationWindowOpen(true);
    popup.focus();
    toast.info('Đã mở cửa sổ trình chiếu', 'Chuyển slide trong phòng luyện sẽ đồng bộ sang cửa sổ này.');
  };

  const handleStart = async () => {
    if (settings.presentationLayout === 'window' && presentation) {
      openPresentationWindow();
    }
    const ok = await live.start();
    if (ok && session?.settings.initialPhaseId) {
      live.setPhaseManually(session.settings.initialPhaseId);
    }
    if (ok) {
      toast.success('Buổi luyện đã bắt đầu', 'Thời gian và dữ liệu chỉ được ghi từ bây giờ.');
    }
  };

  const handleEnd = async () => {
    setEndOpen(false);
    if (recording.state === 'recording') {
      await recording.stop();
    }
    const reportId = await live.end();
    if (reportId) {
      navigate(`/reports/${reportId}`, { replace: true });
    }
  };

  const handleFinalizeStored = async () => {
    if (!session || !lesson) return;
    setFinalizingStored(true);
    setStoredError(null);
    try {
      const result = await finalizePracticeSession({
        sessionId: session.id,
        lesson,
        provider,
        allowAiSummary: true,
      });
      toast.success('Đã tạo báo cáo từ dữ liệu đã lưu');
      navigate(`/reports/${result.report.id}`, { replace: true });
    } catch (error) {
      console.error(error);
      setStoredError('Không tạo được báo cáo từ dữ liệu đã lưu. Dữ liệu vẫn nằm trong IndexedDB.');
    } finally {
      setFinalizingStored(false);
    }
  };

  const handleDiscard = async () => {
    if (!session) return;
    try {
      await sessionRepo.remove(session.id);
      toast.info('Đã xóa buổi luyện bị gián đoạn');
      navigate('/practice', { replace: true });
    } catch (error) {
      console.error(error);
      toast.error('Không xóa được buổi luyện');
    }
  };

  const handleManualSubmit = () => {
    const ok = live.submitTeacherText(manualText, 'manual');
    if (ok) setManualText('');
  };

  const handleExit = () => {
    setExitOpen(false);
    if (live.active) {
      live.pause();
      toast.info('Đã tạm dừng buổi luyện', 'Bạn có thể khôi phục từ mục Báo cáo hoặc thông báo.');
      navigate('/');
      return;
    }
    navigate('/');
  };

  const toggleCamera = async () => {
    if (camera.state === 'ready') {
      camera.stop();
      return;
    }
    const ok = await camera.start(settings.defaultCameraId || undefined);
    if (!ok && camera.message) toast.warning('Không bật được camera', camera.message);
  };

  const toggleMic = async () => {
    if (mic.state === 'ready') {
      mic.stop();
      return;
    }
    const ok = await mic.start(settings.defaultMicId || undefined);
    if (!ok && mic.message) toast.warning('Không bật được micro', mic.message);
  };

  const updateRecordEnabled = (value: boolean) => {
    setRecordEnabled(value);
    if (session) {
      void sessionRepo.save({ ...session, settings: { ...session.settings, recordingEnabled: value } });
    }
  };

  if (!sessionId) {
    return (
      <div className="grid min-h-dvh place-items-center p-5">
        <GlassCard className="max-w-md text-center">
          <EmptyState
            icon={<FileWarning className="h-6 w-6" />}
            title="Thiếu mã buổi luyện"
            description="Đường dẫn không hợp lệ. Hãy quay lại trang luyện tập."
            action={<Button onClick={() => navigate('/practice')}>Về luyện tập</Button>}
          />
        </GlassCard>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center p-5">
        <LoadingState label="Đang mở phòng luyện tập…" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="grid min-h-dvh place-items-center p-5">
        <GlassCard className="max-w-md text-center">
          <EmptyState
            icon={<FileWarning className="h-6 w-6" />}
            title="Không tìm thấy buổi luyện"
            description="Buổi luyện có thể đã bị xóa khỏi thiết bị này."
            action={<Button onClick={() => navigate('/practice')}>Tạo buổi luyện mới</Button>}
          />
        </GlassCard>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="grid min-h-dvh place-items-center p-5">
        <GlassCard className="max-w-md text-center">
          <EmptyState
            icon={<BookOpen className="h-6 w-6" />}
            title="Không tìm thấy kế hoạch bài dạy"
            description="Bài dạy của buổi luyện này đã bị xóa. Bạn vẫn có thể xóa buổi luyện hoặc tạo buổi mới."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" onClick={() => setDiscardOpen(true)}>
                  Xóa buổi luyện
                </Button>
                <Button onClick={() => navigate('/practice')}>Tạo buổi luyện mới</Button>
              </div>
            }
          />
        </GlassCard>
        <ConfirmDialog
          open={discardOpen}
          onClose={() => setDiscardOpen(false)}
          onConfirm={handleDiscard}
          title="Xóa buổi luyện?"
          message="Dữ liệu đo của buổi luyện này sẽ bị xóa khỏi thiết bị."
          confirmLabel="Xóa"
        />
      </div>
    );
  }

  if (interruptedOnLoad && !completedOnLoad) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[var(--bg)] p-4">
        <GlassCard className="w-full max-w-xl" padding="lg">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--warning-soft)] text-[var(--warning)]">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h1 className="mt-3 font-display text-xl font-bold text-[var(--text)]">Buổi luyện bị gián đoạn</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-2)]">
            Trang đã được tải lại hoặc đóng khi buổi luyện đang chạy. Hệ thống <strong>không tự chạy lại đồng hồ</strong>.
            Bạn có thể tạo báo cáo từ dữ liệu đã lưu, hoặc bỏ buổi luyện này.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">Bài dạy</p>
              <p className="mt-0.5 text-[12.5px] font-semibold text-[var(--text)]">{session.lessonTitle}</p>
            </div>
            <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">Thời lượng đã lưu</p>
              <p className="mt-0.5 text-[12.5px] font-semibold text-[var(--text)]">
                {formatClock(session.durationSec)} · {formatRelative(session.startedAt)}
              </p>
            </div>
          </div>
          {session.durationSec < 5 && (
            <InfoNote tone="warning">
              Buổi luyện chỉ lưu được {session.durationSec} giây dữ liệu. Báo cáo có thể chưa đủ bằng chứng để chấm điểm.
            </InfoNote>
          )}
          {storedError && (
            <p className="mt-3 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[12px] text-[var(--danger)]">{storedError}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="primary"
              icon={<Sparkles className="h-4 w-4" />}
              loading={finalizingStored}
              onClick={() => void handleFinalizeStored()}
            >
              Tạo báo cáo từ dữ liệu đã lưu
            </Button>
            <Button variant="secondary" onClick={() => setDiscardOpen(true)}>
              Bỏ buổi luyện
            </Button>
            <Button variant="ghost" onClick={() => navigate('/reports')}>
              Về báo cáo
            </Button>
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-[var(--muted)]">
            Báo cáo chỉ dùng dữ liệu thật đã ghi trước khi gián đoạn. Không có phần nào được tạo giả.
          </p>
        </GlassCard>
        <ConfirmDialog
          open={discardOpen}
          onClose={() => setDiscardOpen(false)}
          onConfirm={handleDiscard}
          title="Bỏ buổi luyện bị gián đoạn?"
          message="Toàn bộ dữ liệu đo và lời giảng đã lưu của buổi này sẽ bị xóa khỏi thiết bị."
          confirmLabel="Xóa buổi luyện"
        />
      </div>
    );
  }

  if (completedOnLoad && !report) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[var(--bg)] p-4">
        <GlassCard className="w-full max-w-xl" padding="lg">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--warning-soft)] text-[var(--warning)]">
            <FileWarning className="h-6 w-6" />
          </span>
          <h1 className="mt-3 font-display text-xl font-bold text-[var(--text)]">Buổi luyện đã kết thúc nhưng thiếu báo cáo</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-2)]">
            Dữ liệu buổi luyện vẫn được lưu trên thiết bị. Bạn có thể tạo lại báo cáo từ dữ liệu đó.
          </p>
          {storedError && (
            <p className="mt-3 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[12px] text-[var(--danger)]">{storedError}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="primary"
              icon={<Sparkles className="h-4 w-4" />}
              loading={finalizingStored}
              onClick={() => void handleFinalizeStored()}
            >
              Tạo lại báo cáo
            </Button>
            <Button variant="ghost" onClick={() => navigate('/reports')}>
              Về báo cáo
            </Button>
          </div>
        </GlassCard>
      </div>
    );
  }

  const micState = micLabel(mic.state);
  const cameraState = cameraLabel(camera.state);
  const elapsedSec = live.elapsed;
  const estimatedTotalSec = phases.reduce((sum, phase) => sum + (phase.estimatedDurationMin || 0) * 60, 0);
  const progressPercent = estimatedTotalSec > 0 ? Math.min(100, (elapsedSec / estimatedTotalSec) * 100) : 0;
  const active = live.active;
  const paused = live.paused;
  const isPrestart = live.status === 'ready' && !active && !paused;
  const presentationLayout = settings.presentationLayout;
  const showPresentation = Boolean(presentation && presentation.slides.length > 0);
  const currentSlideTitle =
    presentation && presentation.slides[safeSlideIndex]?.title
      ? presentation.slides[safeSlideIndex].title
      : `Slide ${safeSlideIndex + 1}`;

  return (
    <div className="min-h-dvh bg-[var(--bg)] pb-6">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface-strong)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-2 px-3 py-2.5 sm:px-5">
          <Logo collapsed size={34} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="max-w-full truncate font-display text-[14px] font-bold leading-tight text-[var(--text)] sm:text-[15px]">
                {lesson.title}
              </h1>
              {lesson.isDemo && <Badge tone="demo">DEMO</Badge>}
              <Badge tone="outline">{MODE_LABELS[session.mode]}</Badge>
              {session.settings.scenario && <Badge tone="lavender">{SCENARIO_LABELS[session.settings.scenario]}</Badge>}
            </div>
            <p className="truncate text-[10.5px] text-[var(--muted)]">
              {session.className ?? `Lớp ${lesson.grade}A`} · {formatDate(session.startedAt, true)}
              {session.trainingExerciseId ? ' · bài luyện có tiêu chí' : ''}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <StatusPill
              icon={<Clock3 className="h-3.5 w-3.5" />}
              label={formatClock(elapsedSec)}
              tone={active ? 'accent' : 'neutral'}
            />
            <StatusPill
              icon={<Circle className={cn('h-3 w-3', active ? 'fill-current' : '')} />}
              label={active ? 'Đang luyện' : paused ? 'Tạm dừng' : isPrestart ? 'Chưa bắt đầu' : 'Đã dừng'}
              tone={active ? 'success' : paused ? 'warning' : 'neutral'}
            />
            {recordEnabled && recording.state === 'recording' && (
              <StatusPill icon={<Radio className="h-3.5 w-3.5 animate-pulse" />} label="Đang ghi cục bộ" tone="danger" />
            )}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              icon={<ChevronLeft className="h-4 w-4" />}
              onClick={() => (active || paused ? setExitOpen(true) : navigate('/'))}
            >
              <span className="hidden sm:inline">Thoát</span>
            </Button>
            {isPrestart ? (
              <Button size="sm" icon={<Play className="h-4 w-4" />} loading={live.finalizing} onClick={() => void handleStart()}>
                Bắt đầu
              </Button>
            ) : paused ? (
              <Button size="sm" icon={<Play className="h-4 w-4" />} onClick={live.resume}>
                Tiếp tục
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Pause className="h-4 w-4" />}
                  onClick={live.pause}
                  disabled={!active}
                >
                  <span className="hidden sm:inline">Tạm dừng</span>
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Square className="h-3.5 w-3.5" />}
                  loading={live.finalizing}
                  onClick={() => setEndOpen(true)}
                >
                  Kết thúc
                </Button>
              </>
            )}
          </div>
        </div>
        {(active || paused) && (
          <div className="h-1 w-full bg-[var(--surface-muted)]">
            <div
              className="h-full bg-[var(--accent)] transition-[width] duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </header>

      <main className="mx-auto grid max-w-[1560px] gap-3 px-3 py-3 sm:px-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
        <section className="space-y-3">
          <GlassCard padding="none" className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-soft)] px-2.5 py-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--text)]">
                <MonitorPlay className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                Sân khấu
              </span>
              {showPresentation && presentationLayout === 'tabs' && (
                <div
                  className="inline-flex rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-0.5"
                  role="tablist"
                  aria-label="Chọn khung hiển thị"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={stageTab === 'camera'}
                    onClick={() => setStageTab('camera')}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                      stageTab === 'camera'
                        ? 'bg-[var(--surface-solid)] text-[var(--text)] shadow-sm'
                        : 'text-[var(--muted)] hover:text-[var(--text)]',
                    )}
                  >
                    <Camera className="h-3 w-3" /> Camera
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={stageTab === 'slide'}
                    onClick={() => setStageTab('slide')}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                      stageTab === 'slide'
                        ? 'bg-[var(--surface-solid)] text-[var(--text)] shadow-sm'
                        : 'text-[var(--muted)] hover:text-[var(--text)]',
                    )}
                  >
                    <MonitorPlay className="h-3 w-3" /> Slide {safeSlideIndex + 1}
                  </button>
                </div>
              )}
              {showPresentation && (
                <span className="hidden items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)] md:inline-flex">
                  <LayoutGrid className="h-3 w-3" />
                  {PRESENTATION_LAYOUT_LABELS[presentationLayout]}
                </span>
              )}
              {presentation?.visualMode === 'pdf' && (
                <Badge tone="success" dot>
                  PDF gốc
                </Badge>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <Button
                  size="xs"
                  variant="soft"
                  icon={showPresentation ? <FileUp className="h-3.5 w-3.5" /> : <MonitorUp className="h-3.5 w-3.5" />}
                  onClick={() => setPresentationModalOpen(true)}
                >
                  {showPresentation ? 'Thay PPTX' : 'Tải PPTX'}
                </Button>
                <Select
                  className="w-[190px]"
                  aria-label="Bố cục trình chiếu"
                  title={PRESENTATION_LAYOUT_HINTS[presentationLayout]}
                  value={presentationLayout}
                  onChange={(event) => settings.update({ presentationLayout: event.target.value as PresentationLayout })}
                  options={(
                    ['slide_main', 'tabs', 'side', 'window'] as PresentationLayout[]
                  ).map((layout) => ({ value: layout, label: PRESENTATION_LAYOUT_LABELS[layout] }))}
                />
              </div>
            </div>

            <div
              className={cn(
                'relative overflow-hidden bg-[#0b1220]',
                showPresentation && presentationLayout === 'side'
                  ? 'grid aspect-video grid-cols-[minmax(0,1.45fr)_minmax(104px,0.55fr)] gap-1.5 p-1.5'
                  : 'aspect-video',
              )}
            >
              {showPresentation && presentation && presentationLayout !== 'window' && (
                <div
                  className={cn(
                    'min-h-0 min-w-0 overflow-hidden',
                    presentationLayout === 'slide_main' && 'absolute inset-0',
                    presentationLayout === 'tabs' && cn('absolute inset-0', stageTab !== 'slide' && 'hidden'),
                    presentationLayout === 'side' && 'relative rounded-lg',
                  )}
                >
                  <SlideViewer
                    presentation={presentation}
                    index={safeSlideIndex}
                    onChange={setSlideIndex}
                    className="h-full"
                    fitHeight
                    suggestedIndex={slideSuggestion?.index ?? null}
                    onOpenWindow={openPresentationWindow}
                    onReplace={() => setPresentationModalOpen(true)}
                    enableKeyboard={presentationLayout !== 'tabs' || stageTab === 'slide'}
                  />
                </div>
              )}

              <div
                className={cn(
                  'min-h-0 min-w-0',
                  showPresentation && presentationLayout === 'slide_main' &&
                    'absolute bottom-11 right-2 z-20 w-[30%] max-w-[300px] overflow-hidden rounded-xl border-2 border-white/25 shadow-2xl',
                  showPresentation && presentationLayout === 'tabs' &&
                    cn('absolute inset-0', stageTab !== 'camera' && 'hidden'),
                  showPresentation && presentationLayout === 'side' &&
                    'relative flex items-center justify-center overflow-hidden rounded-lg bg-black/40',
                  (!showPresentation || presentationLayout === 'window') && 'absolute inset-0',
                )}
              >
                <TeacherCameraView
                  videoRef={camera.videoRef}
                  overlayRef={overlayRef}
                  cameraState={camera.state}
                  cameraMessage={camera.message}
                  poseStatus={pose.status}
                  poseMessage={pose.message}
                  phaseName={live.phaseName}
                  onEnable={() => void toggleCamera()}
                  compact={showPresentation && presentationLayout === 'slide_main'}
                  className={cn(
                    !showPresentation ||
                      presentationLayout === 'tabs' ||
                      presentationLayout === 'window'
                      ? 'h-full w-full aspect-auto'
                      : undefined,
                  )}
                />
              </div>

              {!showPresentation && (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center px-3">
                  <button
                    type="button"
                    onClick={() => setPresentationModalOpen(true)}
                    className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-[10.5px] font-semibold text-white/80 backdrop-blur transition-colors hover:bg-black/70 hover:text-white"
                  >
                    <MonitorUp className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Tải PPTX để dạy kèm slide — học sinh AI sẽ đọc nội dung slide hiện tại</span>
                  </button>
                </div>
              )}
            </div>

            {showPresentation && presentation && presentationLayout === 'window' && (
              <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2">
                <Badge tone={presentationWindowOpen ? 'success' : 'neutral'} dot>
                  {presentationWindowOpen ? 'Cửa sổ đang mở' : 'Cửa sổ trình chiếu'}
                </Badge>
                <p className="min-w-0 flex-1 truncate text-[10.5px] text-[var(--muted)]">
                  {currentSlideTitle} · {safeSlideIndex + 1}/{presentationSlideCount}
                </p>
                <Button
                  size="xs"
                  variant="ghost"
                  aria-label="Slide trước"
                  disabled={safeSlideIndex === 0}
                  onClick={() => setSlideIndex((current) => currentSlideIndex(presentationSlideCount, current - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  aria-label="Slide tiếp theo"
                  disabled={safeSlideIndex >= presentationSlideCount - 1}
                  onClick={() => setSlideIndex((current) => currentSlideIndex(presentationSlideCount, current + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                {slideSuggestion && slideSuggestion.index !== safeSlideIndex && (
                  <Button
                    size="xs"
                    variant="soft"
                    icon={<Lightbulb className="h-3.5 w-3.5" />}
                    onClick={() => setSlideIndex(slideSuggestion.index)}
                  >
                    Gợi ý slide {slideSuggestion.index + 1}
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="secondary"
                  icon={<ExternalLink className="h-3.5 w-3.5" />}
                  onClick={openPresentationWindow}
                >
                  {presentationWindowOpen ? 'Focus cửa sổ' : 'Mở cửa sổ'}
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-soft)] px-3 py-2">
              <Button
                variant={camera.state === 'ready' ? 'soft' : 'ghost'}
                size="sm"
                icon={camera.state === 'ready' ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                loading={camera.state === 'requesting'}
                onClick={() => void toggleCamera()}
              >
                {camera.state === 'ready' ? 'Tắt camera' : 'Bật camera'}
              </Button>
              <Button
                variant={mic.state === 'ready' ? 'soft' : 'ghost'}
                size="sm"
                icon={mic.state === 'ready' ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                loading={mic.state === 'requesting'}
                onClick={() => void toggleMic()}
              >
                {mic.state === 'ready' ? 'Tắt micro' : 'Bật micro'}
              </Button>
              <div className="flex min-w-[150px] flex-1 items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-100',
                      mic.speaking ? 'bg-[var(--success)]' : 'bg-[var(--accent)]',
                    )}
                    style={{ width: `${Math.min(100, Math.round(mic.level * 100))}%` }}
                  />
                </div>
                <span className="w-[105px] shrink-0 text-right text-[10px] text-[var(--muted)]">
                  {mic.state === 'ready' ? `${mic.volumeDb} dB` : 'Chưa bật micro'}
                </span>
              </div>
              <StatusPill icon={<Mic className="h-3.5 w-3.5" />} label={micState.text} tone={micState.tone} />
              <StatusPill icon={<Video className="h-3.5 w-3.5" />} label={cameraState.text} tone={cameraState.tone} />
            </div>

            {(camera.message || mic.message) && (
              <div className="space-y-1 px-3 py-2">
                {camera.message && <p className="text-[11px] text-[var(--danger)]">{camera.message}</p>}
                {mic.message && <p className="text-[11px] text-[var(--danger)]">{mic.message}</p>}
              </div>
            )}
          </GlassCard>

          {isPrestart && (
            <div className="grid gap-3 sm:grid-cols-3">
              <GlassCard className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[var(--success)]" />
                <div>
                  <p className="text-[12px] font-bold text-[var(--text)]">Quyền riêng tư</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-2)]">
                    Không nhận diện danh tính hay cảm xúc. Video không rời thiết bị.
                  </p>
                </div>
              </GlassCard>
              <GlassCard className="flex items-start gap-2.5">
                <Wand2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[var(--lavender)]" />
                <div>
                  <p className="text-[12px] font-bold text-[var(--text)]">Học sinh AI hư cấu</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-2)]">
                    Phản hồi dựa trên bài dạy, chỉ để bạn luyện tập.
                  </p>
                </div>
              </GlassCard>
              <GlassCard className="flex items-start gap-2.5">
                <Mic className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[var(--accent-strong)]" />
                <div>
                  <p className="text-[12px] font-bold text-[var(--text)]">Không cần thiết bị</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-2)]">
                    Có thể nhập lời giảng thủ công nếu micro không khả dụng.
                  </p>
                </div>
              </GlassCard>
            </div>
          )}

          <GlassCard padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-2.5">
              <div>
                <h2 className="text-[13px] font-bold text-[var(--text)]">Lời giảng & hội thoại</h2>
                <p className="text-[10.5px] text-[var(--muted)]">
                  {teacherSegments} lượt giáo viên · {totalSegments - teacherSegments} lượt học sinh AI
                </p>
              </div>
              <Badge tone={live.speechStatus === 'listening' ? 'success' : live.speechStatus === 'error' ? 'danger' : 'neutral'} dot>
                {live.speechStatus === 'listening'
                  ? 'Đang nghe'
                  : live.speechStatus === 'starting'
                    ? 'Đang khởi động'
                    : live.speechStatus === 'unsupported'
                      ? 'Không hỗ trợ nhận dạng'
                      : live.speechStatus === 'error'
                        ? 'Lỗi nhận dạng'
                        : 'Nhập thủ công'}
              </Badge>
            </div>

            <div className="thin-scrollbar max-h-[260px] space-y-2 overflow-y-auto border-y border-[var(--border-soft)] px-3 py-2.5">
              {live.transcript.length === 0 && !live.interim && (
                <div className="py-6 text-center">
                  <p className="text-[12px] font-semibold text-[var(--text)]">
                    {isPrestart ? 'Buổi luyện chưa bắt đầu' : 'Chưa có lời giảng nào'}
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-[var(--muted)]">
                    {isPrestart
                      ? 'Bấm Bắt đầu để đồng hồ và dữ liệu bắt đầu ghi. Bạn có thể nhập lời giảng sau khi bắt đầu.'
                      : 'Nói vào micro hoặc nhập lời giảng bên dưới. Lời giảng thật của bạn là bằng chứng cho báo cáo.'}
                  </p>
                </div>
              )}
              {live.transcript.map((segment) => {
                const persona = segment.studentId ? personaById.get(segment.studentId) : null;
                const isTeacher = segment.speaker === 'teacher';
                return (
                  <div
                    key={segment.id}
                    className={cn('flex gap-2', isTeacher ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[86%] rounded-2xl px-3 py-2',
                        isTeacher
                          ? 'bg-[var(--accent-soft)] text-[var(--text)]'
                          : 'border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text)]',
                      )}
                    >
                      <p className="mb-0.5 flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wide text-[var(--muted)]">
                        {isTeacher ? 'Giáo viên' : persona?.name ?? 'Học sinh AI'} · {formatTimestamp(segment.startTime)}
                        {segment.source === 'ai' && <Badge tone="demo">AI</Badge>}
                        {segment.source === 'manual' && <Badge tone="neutral">nhập tay</Badge>}
                      </p>
                      <p className="text-[12px] leading-relaxed">{segment.text}</p>
                    </div>
                  </div>
                );
              })}
              {live.interim && (
                <div className="flex justify-end">
                  <div className="max-w-[86%] rounded-2xl border border-dashed border-[var(--accent)]/40 bg-[var(--accent-softer)] px-3 py-2">
                    <p className="text-[9.5px] font-bold uppercase tracking-wide text-[var(--muted)]">Đang nghe…</p>
                    <p className="text-[12px] italic leading-relaxed text-[var(--text-2)]">{live.interim}</p>
                  </div>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>

            <div className="p-3">
              <div className="flex items-end gap-2">
                <Textarea
                  rows={2}
                  className="flex-1"
                  placeholder={
                    active
                      ? 'Nhập lời giảng hoặc câu hỏi của bạn… (Ctrl + Enter để gửi)'
                      : 'Bấm Bắt đầu để nhập lời giảng…'
                  }
                  value={manualText}
                  disabled={!active}
                  onChange={(event) => setManualText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                      event.preventDefault();
                      handleManualSubmit();
                    }
                  }}
                  aria-label="Nhập lời giảng thủ công"
                />
                <Button
                  icon={<Send className="h-4 w-4" />}
                  disabled={!active || !manualText.trim()}
                  onClick={handleManualSubmit}
                >
                  Gửi
                </Button>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
                <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">
                  {live.speechMessage ??
                    (mic.state === 'ready'
                      ? 'Micro đang bật. Trình duyệt có thể nhận dạng giọng nói tiếng Việt nếu được hỗ trợ.'
                      : 'Micro đang tắt nên chỉ nhận lời giảng nhập thủ công.')}
                </p>
                {live.speechStatus === 'listening' && <Badge tone="success" dot>Nhận dạng giọng nói</Badge>}
              </div>
            </div>
          </GlassCard>

          {live.error && (
            <InfoNote tone="warning">
              <span className="inline-flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {live.error}
              </span>
            </InfoNote>
          )}
        </section>

        <aside className="space-y-3">
          {isPrestart ? (
            <>
              <GlassCard tone="accent">
                <SectionHeader
                  title="Sẵn sàng bắt đầu"
                  description="Đồng hồ chỉ chạy sau khi bạn bấm nút bên dưới."
                  icon={<MonitorPlay className="h-5 w-5" />}
                />
                <dl className="mt-3 space-y-2 text-[12px]">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-[var(--muted)]">Bài dạy</dt>
                    <dd className="max-w-[65%] text-right font-semibold text-[var(--text)]">{lesson.title}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--muted)]">Chế độ</dt>
                    <dd className="font-semibold text-[var(--text)]">{MODE_LABELS[session.mode]}</dd>
                  </div>
                  {session.settings.scenario && (
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-[var(--muted)]">Tình huống</dt>
                      <dd className="max-w-[65%] text-right font-semibold text-[var(--text)]">
                        {SCENARIO_LABELS[session.settings.scenario]}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--muted)]">Học sinh AI</dt>
                    <dd className="font-semibold text-[var(--text)]">{simPersonas.length} bạn</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--muted)]">Thời lượng dự kiến</dt>
                    <dd className="font-semibold text-[var(--text)]">
                      {estimatedTotalSec ? `${Math.round(estimatedTotalSec / 60)} phút` : 'Theo bài dạy'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-2">
                    <dt className="text-[var(--muted)]">Đã xác nhận bài dạy</dt>
                    <dd className="inline-flex items-center gap-1 font-semibold text-[var(--success)]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Có
                    </dd>
                  </div>
                </dl>
                <Button
                  className="mt-4"
                  variant="primary"
                  size="lg"
                  fullWidth
                  icon={<Play className="h-4 w-4" />}
                  iconRight={<ArrowRight className="h-4 w-4" />}
                  loading={live.finalizing}
                  onClick={() => void handleStart()}
                >
                  Bắt đầu buổi luyện
                </Button>
                <p className="mt-2 text-center text-[10.5px] leading-relaxed text-[var(--muted)]">
                  Không cần camera hay micro để bắt đầu. Bạn có thể bật thiết bị bất cứ lúc nào.
                </p>
              </GlassCard>

              <GlassCard>
                <SectionHeader title="Thiết bị" description="Chỉ bật khi bạn bấm. Có thể tắt bất cứ lúc nào." />
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text)]">
                        <Camera className="h-4 w-4 text-[var(--accent-strong)]" /> Camera
                      </p>
                      <Badge tone={cameraState.tone} dot>
                        {cameraState.text}
                      </Badge>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        fullWidth
                        icon={camera.state === 'ready' ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                        loading={camera.state === 'requesting'}
                        onClick={() => void toggleCamera()}
                      >
                        {camera.state === 'ready' ? 'Tắt camera' : 'Bật camera'}
                      </Button>
                    </div>
                    {camera.devices.length > 1 && camera.state === 'ready' && (
                      <select
                        aria-label="Chọn camera"
                        className="field mt-2 py-1.5 text-[11px]"
                        value={camera.activeDeviceId ?? ''}
                        onChange={(event) => void camera.switchDevice(event.target.value)}
                      >
                        {camera.devices.map((device) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text)]">
                        <Mic className="h-4 w-4 text-[var(--accent-strong)]" /> Micro
                      </p>
                      <Badge tone={micState.tone} dot>
                        {micState.text}
                      </Badge>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        fullWidth
                        icon={mic.state === 'ready' ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                        loading={mic.state === 'requesting'}
                        onClick={() => void toggleMic()}
                      >
                        {mic.state === 'ready' ? 'Tắt micro' : 'Bật micro'}
                      </Button>
                    </div>
                    {mic.devices.length > 1 && mic.state === 'ready' && (
                      <select
                        aria-label="Chọn micro"
                        className="field mt-2 py-1.5 text-[11px]"
                        value={mic.activeDeviceId ?? ''}
                        onChange={(event) => void mic.start(event.target.value)}
                      >
                        {mic.devices.map((device) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <Switch
                    checked={recordEnabled}
                    onChange={updateRecordEnabled}
                    label="Ghi hình/ghi âm cục bộ"
                    description="Chỉ lưu trong IndexedDB trên thiết bị này. Không tải lên máy chủ."
                  />
                </div>
              </GlassCard>

              <GlassCard>
                <SectionHeader title="Lớp học sẽ tham gia" description="Học sinh AI hư cấu, không phải người thật." />
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
                  {simPersonas.slice(0, 8).map((persona) => (
                    <StudentCard key={persona.id} persona={persona} compact />
                  ))}
                </div>
                {simPersonas.length > 8 && (
                  <p className="mt-2 text-[10.5px] text-[var(--muted)]">+{simPersonas.length - 8} học sinh khác trong lớp</p>
                )}
              </GlassCard>
            </>
          ) : (
            <>
              <GlassCard padding="sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Tiến trình buổi luyện</p>
                    <p className="truncate font-display text-[16px] font-bold text-[var(--text)]">
                      {formatClock(elapsedSec)}
                      {paused && <span className="ml-1.5 text-[11px] font-semibold text-[var(--warning)]">· tạm dừng</span>}
                    </p>
                  </div>
                  <CircularMini value={progressPercent} />
                </div>
                <div className="mt-2">
                  <Select
                    aria-label="Chọn hoạt động"
                    value={live.phaseId ?? ''}
                    onChange={(event) => live.setPhaseManually(event.target.value || null)}
                    options={phases.map((phase, index) => ({
                      value: phase.id,
                      label: `${index + 1}. ${phase.name}`,
                    }))}
                    disabled={!active}
                  />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-lg bg-[var(--surface-muted)] py-1.5">
                    <p className="font-display text-[14px] font-bold text-[var(--text)]">{live.transcript.length}</p>
                    <p className="text-[9px] text-[var(--muted)]">Lượt nói</p>
                  </div>
                  <div className="rounded-lg bg-[var(--surface-muted)] py-1.5">
                    <p className="font-display text-[14px] font-bold text-[var(--text)]">{live.feedback.length}</p>
                    <p className="text-[9px] text-[var(--muted)]">Coach</p>
                  </div>
                  <div className="rounded-lg bg-[var(--surface-muted)] py-1.5">
                    <p className="font-display text-[14px] font-bold text-[var(--text)]">{live.raisedHands.length}</p>
                    <p className="text-[9px] text-[var(--muted)]">Giơ tay</p>
                  </div>
                </div>
                {phaseIndex >= 0 && (
                  <p className="mt-2 text-[10px] text-[var(--muted)]">
                    Hoạt động {phaseIndex + 1}/{phases.length}
                    {estimatedTotalSec ? ` · dự kiến ${Math.round(estimatedTotalSec / 60)} phút` : ''}
                  </p>
                )}
              </GlassCard>

              <Tabs
                active={tab}
                onChange={setTab}
                tabs={[
                  { id: 'class', label: `Lớp học`, icon: <UsersRound className="h-3.5 w-3.5" /> },
                  { id: 'coach', label: `Coach (${visibleFeedback.length})`, icon: <Sparkles className="h-3.5 w-3.5" /> },
                  { id: 'events', label: 'Sự kiện', icon: <Hand className="h-3.5 w-3.5" /> },
                ]}
              />

              <GlassCard padding="sm" className="thin-scrollbar max-h-[560px] overflow-y-auto">
                {tab === 'class' && (
                  <>
                    {raisedPersonas.length > 0 && (
                      <div className="mb-2 rounded-xl bg-[var(--accent-softer)] p-2.5">
                        <p className="flex items-center gap-1.5 text-[10.5px] font-bold text-[var(--accent-strong)]">
                          <Hand className="h-3.5 w-3.5" /> Đang giơ tay
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {raisedPersonas.map((persona) => (
                            <button
                              key={persona.id}
                              type="button"
                              disabled={!active}
                              onClick={() => live.callStudent(persona.id)}
                              className="rounded-lg bg-[var(--surface-solid)] px-2 py-1 text-[11px] font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
                            >
                              Gọi {persona.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
                      {simPersonas.map((persona) => {
                        const state = live.states[persona.id] ?? (live.raisedHands.includes(persona.id) ? 'hand' : 'idle');
                        const lastEvent = [...live.events].reverse().find((event) => event.studentId === persona.id);
                        return (
                          <StudentCard
                            key={persona.id}
                            persona={persona}
                            state={state}
                            line={lastEvent?.response}
                            compact
                            onCall={active ? (item) => live.callStudent(item.id) : undefined}
                          />
                        );
                      })}
                    </div>
                    {simPersonas.length === 0 && (
                      <EmptyState
                        compact
                        icon={<UsersRound className="h-5 w-5" />}
                        title="Chưa có học sinh AI"
                        description="Thêm hồ sơ học sinh trong Lớp học AI rồi tạo buổi luyện mới."
                        action={<Button size="sm" onClick={() => navigate('/classroom')}>Mở Lớp học AI</Button>}
                      />
                    )}
                  </>
                )}

                {tab === 'coach' && (
                  <div className="space-y-2">
                    {visibleFeedback.length === 0 ? (
                      <div className="py-8 text-center">
                        <Sparkles className="mx-auto h-7 w-7 text-[var(--muted)]" />
                        <p className="mt-2 text-[12px] font-semibold text-[var(--text)]">Coach chưa có phản hồi</p>
                        <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-[var(--muted)]">
                          Phản hồi trực tiếp chỉ xuất hiện sau khi có đủ dữ liệu thật (sau khoảng 20 giây luyện và khi bật
                          micro/camera). Không có phản hồi giả.
                        </p>
                      </div>
                    ) : (
                      visibleFeedback.slice(0, 8).map((event: FeedbackEvent) => (
                        <FeedbackCard
                          key={event.id}
                          event={event}
                          compact
                          onPin={live.pinFeedback}
                          onDismiss={live.dismissFeedback}
                          onRate={live.rateFeedback}
                        />
                      ))
                    )}
                  </div>
                )}

                {tab === 'events' && (
                  <div className="space-y-1.5">
                    {live.events.length === 0 ? (
                      <div className="py-8 text-center">
                        <Hand className="mx-auto h-7 w-7 text-[var(--muted)]" />
                        <p className="mt-2 text-[12px] font-semibold text-[var(--text)]">Chưa có sự kiện lớp học</p>
                        <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-[var(--muted)]">
                          Khi bạn đặt câu hỏi hoặc gọi học sinh, sự kiện thật từ lớp mô phỏng sẽ xuất hiện ở đây.
                        </p>
                      </div>
                    ) : (
                      [...live.events]
                        .reverse()
                        .slice(0, 30)
                        .map((event) => (
                          <div
                            key={event.id}
                            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 py-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-bold text-[var(--text)]">
                                {event.studentName} · {EVENT_LABELS[event.eventType]}
                              </p>
                              <span className="text-[9.5px] text-[var(--muted)]">{formatTimestamp(event.timestamp)}</span>
                            </div>
                            {event.response && (
                              <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-2)]">
                                {event.response}
                              </p>
                            )}
                            <p className="mt-1 text-[9px] text-[var(--muted)]">
                              {event.source === 'gemini' ? 'Gemini qua proxy' : event.source === 'manual' ? 'Giáo viên nhập' : 'Quy tắc cục bộ'}
                              {event.quality ? ` · ${event.quality}` : ''}
                            </p>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </GlassCard>
            </>
          )}

          {session.trainingExerciseId && (
            <GlassCard>
              <SectionHeader title="Bài luyện có tiêu chí" description="Kết quả chỉ tính từ dữ liệu thật của buổi này." />
              <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--text-2)]">
                Khi kết thúc, hệ thống sẽ đối chiếu tiêu chí với dữ liệu micro, camera, lời giảng và sự kiện lớp học. Tiêu chí
                thiếu dữ liệu sẽ ghi “chưa đủ dữ liệu”, không được tính là đạt.
              </p>
              <Link
                to="/training"
                className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--accent-strong)] hover:underline"
              >
                Xem trung tâm luyện tập <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </GlassCard>
          )}

          <GlassCard padding="sm">
            <p className="flex items-start gap-2 text-[10.5px] leading-relaxed text-[var(--muted)]">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Camera/micro chỉ bật khi bạn bấm. Video không rời thiết bị; MediaPipe chạy cục bộ. Hệ thống không nhận diện
              danh tính hay cảm xúc.
            </p>
          </GlassCard>

          {paused && (
            <InfoNote tone="warning">
              Buổi luyện đang tạm dừng. Đồng hồ và lớp học AI không chạy cho đến khi bạn bấm Tiếp tục.
            </InfoNote>
          )}
          {live.finalizeError && (
            <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] p-3">
              <p className="text-[11.5px] leading-relaxed text-[var(--danger)]">{live.finalizeError}</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                loading={live.finalizing}
                onClick={() => void live.retryFinalize()}
              >
                Thử tạo lại báo cáo
              </Button>
            </div>
          )}
        </aside>
      </main>

      <ConfirmDialog
        open={endOpen}
        onClose={() => setEndOpen(false)}
        onConfirm={() => void handleEnd()}
        loading={live.finalizing}
        title="Kết thúc buổi luyện?"
        message="Đồng hồ sẽ dừng và hệ thống tạo báo cáo từ dữ liệu đã ghi. Báo cáo không tự tạo thêm điểm hay nhận xét."
        confirmLabel="Kết thúc & xem báo cáo"
      />

      <Modal
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        title="Rời phòng luyện tập?"
        description="Buổi luyện đang diễn ra. Bạn có thể tạm dừng để quay lại sau, hoặc ở lại."
        footer={
          <>
            <Button variant="ghost" onClick={() => setExitOpen(false)}>
              Ở lại
            </Button>
            <Button variant="secondary" onClick={() => setExitOpen(false)}>
              Tiếp tục luyện
            </Button>
            <Button variant="danger" onClick={handleExit}>
              Tạm dừng & thoát
            </Button>
          </>
        }
      >
        <InfoNote tone="warning">
          Khi tạm dừng và thoát, dữ liệu đã ghi vẫn được giữ. Buổi luyện sẽ xuất hiện trong thông báo và mục Báo cáo để bạn
          khôi phục hoặc tạo báo cáo từ dữ liệu đã lưu. Hệ thống không tự chạy lại đồng hồ.
        </InfoNote>
      </Modal>

      <Modal
        open={presentationModalOpen}
        onClose={() => setPresentationModalOpen(false)}
        title={presentation ? 'Thay bài trình chiếu' : 'Tải bài trình chiếu'}
        description="Bài trình chiếu được đọc ngay trên thiết bị này. Slide hiện tại sẽ trở thành ngữ cảnh cho học sinh AI."
        size="lg"
        icon={<MonitorPlay className="h-5 w-5" />}
      >
        <PresentationUploadCard
          lessonPlanId={lesson.id}
          presentation={presentation ?? null}
          compact
          onSaved={() => {
            setSlideIndex(0);
            setPresentationModalOpen(false);
          }}
          onRemoved={() => {
            setSlideIndex(0);
            setPresentationModalOpen(false);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={handleDiscard}
        title="Xóa buổi luyện?"
        message="Toàn bộ dữ liệu đo, lời giảng và báo cáo liên quan (nếu có) sẽ bị xóa khỏi thiết bị."
        confirmLabel="Xóa"
      />
    </div>
  );
}

function CircularMini({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <div className="relative grid h-12 w-12 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--surface-muted)" strokeWidth="3.5" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${Math.min(100, rounded) * 0.974} 100`}
        />
      </svg>
      <span className="relative font-display text-[10px] font-bold text-[var(--text)]">{rounded}%</span>
    </div>
  );
}
