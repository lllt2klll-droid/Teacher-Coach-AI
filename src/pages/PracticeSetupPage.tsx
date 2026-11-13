import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle2,
  Clock3,
  Mic,
  MonitorPlay,
  Play,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import {
  Badge,
  EmptyState,
  GlassCard,
  LoadingState,
  PageHeader,
  SectionHeader,
} from '@/components/ui/Display';
import { Button } from '@/components/ui/Button';
import { Select, Slider, Switch } from '@/components/ui/Inputs';
import { InfoNote, Modal } from '@/components/ui/Overlay';
import { DeviceCheckPanel } from '@/components/media/DeviceCheckPanel';
import { PresentationUploadCard } from '@/components/presentation/PresentationUploadCard';
import { usePageTitle } from '@/hooks/usePageTitle';
import { lessonRepo, presentationRepo, studentRepo } from '@/data/repositories';
import { getTrainingExercise } from '@/data/training-exercises';
import { createPracticeSession } from '@/services/session/session-finalizer';
import { useSettingsStore } from '@/store/settings-store';
import type { Difficulty, PresentationLayout, ScenarioType, SessionMode } from '@/types/domain';
import {
  MODE_LABELS,
  PHASE_TYPE_SHORT,
  PRESENTATION_LAYOUT_HINTS,
  PRESENTATION_LAYOUT_LABELS,
  SCENARIO_LABELS,
  STUDENT_COUNTS,
} from '@/lib/format';
import { formatDuration } from '@/lib/format';
import { toast } from '@/store/toast-store';
import { cn } from '@/lib/utils';

const SCENARIO_OPTIONS = Object.entries(SCENARIO_LABELS) as Array<[ScenarioType, string]>;
const DIFFICULTIES: Array<{ value: Difficulty; label: string; hint: string }> = [
  { value: 'easy', label: 'Dễ', hint: 'Học sinh hợp tác, phản hồi rõ ràng' },
  { value: 'medium', label: 'Trung bình', hint: 'Có vài tình huống cần xử lý' },
  { value: 'hard', label: 'Khó', hint: 'Nhiều tình huống bất ngờ' },
];

export function PracticeSetupPage() {
  usePageTitle('Luyện tập giảng dạy');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lessons = useLiveQuery(() => lessonRepo.list(), []);
  const students = useLiveQuery(() => studentRepo.list(), []);
  const settings = useSettingsStore();
  const training = getTrainingExercise(searchParams.get('training'));
  const requestedLesson = searchParams.get('lesson') ?? '';

  const [lessonId, setLessonId] = useState(requestedLesson);
  const [mode, setMode] = useState<SessionMode>(training ? (training.scenario ? 'scenario' : 'focused') : settings.defaultMode);
  const [scenario, setScenario] = useState<ScenarioType>(training?.scenario ?? 'wrong_answer');
  const [studentCount, setStudentCount] = useState(settings.defaultStudentCount);
  const [difficulty, setDifficulty] = useState<Difficulty>(training?.difficulty ?? settings.difficulty);
  const [activity, setActivity] = useState(settings.studentActivity);
  const [feedbackFrequency, setFeedbackFrequency] = useState(settings.feedbackFrequency);
  const [recordingEnabled, setRecordingEnabled] = useState(settings.recordingEnabled);
  const [initialPhaseId, setInitialPhaseId] = useState('');
  const [focusedExerciseId, setFocusedExerciseId] = useState('');
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const realStudents = useMemo(() => (students ?? []).filter((student) => student.isDemo !== true), [students]);
  const availableLessons = useMemo(() => lessons ?? [], [lessons]);
  const selectedLesson = availableLessons.find((lesson) => lesson.id === lessonId) ?? null;
  const confirmedLessons = availableLessons.filter((lesson) => lesson.parsingStatus === 'confirmed');
  const presentationResult = useLiveQuery(
    () => (selectedLesson ? presentationRepo.forLesson(selectedLesson.id) : Promise.resolve(undefined)),
    [selectedLesson?.id],
  );
  const presentation =
    presentationResult && selectedLesson && presentationResult.lessonPlanId === selectedLesson.id
      ? presentationResult
      : null;

  useEffect(() => {
    if (lessonId && availableLessons.some((lesson) => lesson.id === lessonId)) return;
    if (requestedLesson && availableLessons.some((lesson) => lesson.id === requestedLesson)) {
      setLessonId(requestedLesson);
      return;
    }
    const preferred = confirmedLessons.find((lesson) => !lesson.isDemo) ?? confirmedLessons[0];
    if (preferred) setLessonId(preferred.id);
  }, [availableLessons, confirmedLessons, lessonId, requestedLesson]);

  useEffect(() => {
    if (selectedLesson && !initialPhaseId) {
      setInitialPhaseId(selectedLesson.lessonPhases[0]?.id ?? '');
    }
  }, [initialPhaseId, selectedLesson]);

  useEffect(() => {
    if (!training) return;
    setMode(training.scenario ? 'scenario' : 'focused');
    setScenario(training.scenario ?? 'wrong_answer');
    setDifficulty(training.difficulty);
  }, [training]);

  const countOptions = useMemo(() => {
    const available = Math.max(1, realStudents.length);
    return Array.from(new Set(STUDENT_COUNTS.map((count) => Math.min(count, available)))).sort((a, b) => a - b);
  }, [realStudents.length]);

  useEffect(() => {
    if (studentCount > realStudents.length && realStudents.length > 0) {
      setStudentCount(realStudents.length);
    }
  }, [realStudents.length, studentCount]);

  const estimatedDuration = selectedLesson
    ? selectedLesson.lessonPhases.reduce((sum, phase) => sum + (phase.estimatedDurationMin || 0), 0)
    : 0;

  const trainingNeedsCamera = training?.criteria.some((criterion) =>
    ['posture_visibility', 'posture_stability', 'gesture_rate'].includes(criterion.metric),
  );
  const trainingNeedsMic = training?.criteria.some((criterion) =>
    [
      'speaking_ratio',
      'volume_stability',
      'pause_appropriateness',
      'question_count',
      'open_question_count',
      'praise_count',
      'encouragement_count',
      'transition_count',
      'greeting_detected',
      'summary_detected',
      'wrong_answer_support',
    ].includes(criterion.metric),
  );

  const canStart =
    Boolean(selectedLesson) &&
    selectedLesson?.parsingStatus === 'confirmed' &&
    realStudents.length > 0 &&
    studentCount > 0;

  const handleStart = async () => {
    if (!selectedLesson) {
      toast.error('Chưa chọn kế hoạch bài dạy');
      return;
    }
    if (selectedLesson.parsingStatus !== 'confirmed') {
      toast.warning('Kế hoạch chưa được xác nhận', 'Hãy kiểm tra và xác nhận kế hoạch bài dạy trước khi luyện tập.');
      return;
    }
    if (!realStudents.length) {
      toast.error('Chưa có học sinh AI', 'Thêm ít nhất một hồ sơ học sinh AI trong Lớp học AI.');
      return;
    }
    setStarting(true);
    try {
      const session = await createPracticeSession({
        lesson: selectedLesson,
        settings: {
          mode,
          scenario: mode === 'scenario' ? scenario : undefined,
          studentCount: Math.min(studentCount, realStudents.length),
          difficulty,
          studentActivity: activity,
          feedbackFrequency,
          recordingEnabled,
          initialPhaseId: mode === 'focused' ? initialPhaseId || undefined : undefined,
          focusedExerciseId: mode === 'focused' ? focusedExerciseId || undefined : undefined,
        },
        trainingExerciseId: training?.id,
      });
      toast.success(
        'Đã tạo buổi luyện',
        'Bước tiếp theo: bật camera/micro nếu muốn, rồi bấm Bắt đầu trong phòng học.',
      );
      navigate(`/practice/${session.id}/live`);
    } catch (error) {
      console.error(error);
      toast.error('Không tạo được buổi luyện', 'Kiểm tra dữ liệu bài dạy rồi thử lại.');
    } finally {
      setStarting(false);
    }
  };

  if (!lessons || !students) {
    return (
      <div className="space-y-5">
        <PageHeader title="Luyện tập giảng dạy" description="Đang chuẩn bị dữ liệu lớp học…" />
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title={training ? training.title : 'Chuẩn bị buổi luyện'}
        eyebrow={training ? 'Bài luyện có tiêu chí' : 'Bước 1 · Cấu hình lớp học'}
        description={
          training
            ? training.description
            : 'Chọn kế hoạch bài dạy, chế độ mô phỏng và số học sinh. Camera/micro chỉ bật khi bạn cho phép trong phòng học.'
        }
        icon={<MonitorPlay className="h-6 w-6" />}
        actions={
          <>
            <Button variant="secondary" icon={<Camera className="h-4 w-4" />} onClick={() => setDeviceModalOpen(true)}>
              Kiểm tra thiết bị
            </Button>
            <Button variant="primary" icon={<Play className="h-4 w-4" />} loading={starting} onClick={() => void handleStart()} disabled={!canStart}>
              Bắt đầu buổi luyện
            </Button>
          </>
        }
      />

      {training && (
        <InfoNote>
          Bài luyện <strong>{training.title}</strong>: kết quả được tính từ dữ liệu thực của buổi luyện (micro, camera,
          lời giảng và sự kiện lớp học). Tiêu chí thiếu dữ liệu sẽ ghi “chưa đủ dữ liệu”, không được tính là đạt.
        </InfoNote>
      )}
      {trainingNeedsCamera && !trainingNeedsMic && (
        <InfoNote tone="warning">
          Bài luyện này cần camera để đánh giá tư thế. Nếu không bật camera, tiêu chí tư thế sẽ chưa đủ dữ liệu.
        </InfoNote>
      )}
      {trainingNeedsMic && (
        <InfoNote tone="warning">
          Bài luyện này cần micro và lời giảng. Bạn có thể nói trực tiếp hoặc nhập lời giảng thủ công trong phòng học.
        </InfoNote>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <GlassCard>
            <SectionHeader
              title="1. Chọn kế hoạch bài dạy"
              description="Chỉ bài đã xác nhận mới dùng để luyện. Bài chưa kiểm tra sẽ bị khóa."
              icon={<BookOpen className="h-5 w-5" />}
              action={
                <Link to="/lessons/upload" className="text-[11.5px] font-semibold text-[var(--accent-strong)] hover:underline">
                  Tải bài mới
                </Link>
              }
            />
            {availableLessons.length === 0 ? (
              <EmptyState
                compact
                icon={<BookOpen className="h-6 w-6" />}
                title="Chưa có kế hoạch bài dạy"
                description="Tải file hoặc dán nội dung để bắt đầu."
                action={<Button size="sm" onClick={() => navigate('/lessons/upload')}>Tải kế hoạch bài dạy</Button>}
              />
            ) : (
              <div className="mt-3">
                <Select
                  label="Kế hoạch bài dạy"
                  value={lessonId}
                  onChange={(event) => {
                    setLessonId(event.target.value);
                    setInitialPhaseId('');
                    setFocusedExerciseId('');
                  }}
                  options={availableLessons.map((lesson) => ({
                    value: lesson.id,
                    label: `${lesson.isDemo ? '[DEMO] ' : ''}${lesson.title} · Lớp ${lesson.grade}${
                      lesson.parsingStatus === 'confirmed' ? '' : ' (chưa xác nhận)'
                    }`,
                  }))}
                />
                {selectedLesson ? (
                  <div className="mt-2.5 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={selectedLesson.parsingStatus === 'confirmed' ? 'success' : 'warning'} dot>
                        {selectedLesson.parsingStatus === 'confirmed' ? 'Đã xác nhận' : 'Cần kiểm tra'}
                      </Badge>
                      {selectedLesson.isDemo && <Badge tone="demo">DEMO</Badge>}
                      <span className="text-[11px] text-[var(--muted)]">
                        {selectedLesson.subject} · {selectedLesson.lessonPhases.length} hoạt động
                        {estimatedDuration ? ` · ~${formatDuration(estimatedDuration)}` : ''}
                      </span>
                    </div>
                    {selectedLesson.parsingStatus !== 'confirmed' && (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11.5px] text-[var(--warning)]">
                          Kế hoạch này cần được kiểm tra và xác nhận trước khi luyện tập.
                        </p>
                        <Link
                          to={`/lessons/${selectedLesson.id}/review`}
                          className="text-[11.5px] font-bold text-[var(--accent-strong)] hover:underline"
                        >
                          Đi kiểm tra →
                        </Link>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </GlassCard>

          <GlassCard>
            <SectionHeader
              title="2. Bài trình chiếu (PPTX)"
              description="Tuỳ chọn. Tải PPTX trước buổi luyện; đính kèm thêm PDF xuất từ chính file đó để slide hiển thị giống bản gốc."
              icon={<MonitorPlay className="h-5 w-5" />}
              action={<Badge tone="outline">Xử lý cục bộ</Badge>}
            />
            <div className="mt-3">
              <PresentationUploadCard
                key={selectedLesson?.id ?? 'no-lesson'}
                lessonPlanId={selectedLesson?.id ?? null}
                presentation={presentation}
              />
            </div>
            <div className="mt-4">
              <Select
                label="Bố cục khi trình chiếu"
                value={settings.presentationLayout}
                onChange={(event) =>
                  settings.update({ presentationLayout: event.target.value as PresentationLayout })
                }
                options={(['slide_main', 'tabs', 'side', 'window'] as PresentationLayout[]).map((layout) => ({
                  value: layout,
                  label: PRESENTATION_LAYOUT_LABELS[layout],
                }))}
                hint={PRESENTATION_LAYOUT_HINTS[settings.presentationLayout]}
              />
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeader
              title="3. Chọn chế độ mô phỏng"
              description={training ? 'Chế độ được khóa theo bài luyện đã chọn.' : 'Chọn cách lớp học AI phản hồi.'}
              icon={<Sparkles className="h-5 w-5" />}
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(Object.entries(MODE_LABELS) as Array<[SessionMode, string]>).map(([value, label]) => {
                const disabled = Boolean(training);
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setMode(value)}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-all',
                      mode === value
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                        : 'border-[var(--border-soft)] bg-[var(--surface-muted)] hover:border-[var(--accent)]/35',
                      disabled && 'cursor-not-allowed opacity-70',
                    )}
                  >
                    <p className="text-[12.5px] font-bold text-[var(--text)]">{label}</p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--muted)]">
                      {value === 'natural'
                        ? 'Học sinh phản hồi tự nhiên theo nội dung bài.'
                        : value === 'scenario'
                          ? 'Tập trung vào một tình huống sư phạm.'
                          : 'Luyện một hoạt động hoặc bài tập trọng tâm.'}
                    </p>
                  </button>
                );
              })}
            </div>

            {mode === 'scenario' && (
              <Select
                className="mt-3"
                label="Tình huống luyện tập"
                value={scenario}
                onChange={(event) => setScenario(event.target.value as ScenarioType)}
                options={SCENARIO_OPTIONS.map(([value, label]) => ({ value, label }))}
                disabled={Boolean(training?.scenario)}
                hint={
                  training?.scenario
                    ? 'Tình huống được khóa để bài luyện được đánh giá đúng tiêu chí.'
                    : 'Học sinh AI sẽ chủ động tạo tình huống này trong buổi luyện.'
                }
              />
            )}

            {mode === 'focused' && selectedLesson && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Select
                  label="Bắt đầu từ hoạt động"
                  value={initialPhaseId}
                  onChange={(event) => setInitialPhaseId(event.target.value)}
                  options={selectedLesson.lessonPhases.map((phase, index) => ({
                    value: phase.id,
                    label: `${index + 1}. ${phase.name} · ${PHASE_TYPE_SHORT[phase.type]}`,
                  }))}
                />
                <Select
                  label="Bài tập trọng tâm (tuỳ chọn)"
                  value={focusedExerciseId}
                  onChange={(event) => setFocusedExerciseId(event.target.value)}
                  options={[
                    { value: '', label: 'Không chọn bài tập cụ thể' },
                    ...selectedLesson.exercises.map((exercise, index) => ({
                      value: exercise.id,
                      label: `Bài ${index + 1}: ${exercise.prompt.slice(0, 58) || 'Chưa có đề bài'}`,
                    })),
                  ]}
                />
              </div>
            )}
          </GlassCard>

          <GlassCard>
            <SectionHeader
              title="4. Cấu hình lớp học"
              description="Số học sinh lấy từ hồ sơ AI đã tạo. Không tạo học sinh ảo ngoài hồ sơ."
              icon={<UsersRound className="h-5 w-5" />}
            />
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-[var(--text)]">Số học sinh</p>
                <div className="flex gap-1.5">
                  {countOptions.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setStudentCount(count)}
                      className={cn(
                        'flex-1 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-all',
                        studentCount === count
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                          : 'border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-2)]',
                      )}
                    >
                      {count} bạn
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10.5px] text-[var(--muted)]">
                  Có {realStudents.length} hồ sơ học sinh AI. {studentCount > realStudents.length ? 'Chỉ dùng tối đa số hồ sơ hiện có.' : ''}
                </p>
              </div>
              <Select
                label="Độ khó"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as Difficulty)}
                options={DIFFICULTIES.map((item) => ({ value: item.value, label: `${item.label} · ${item.hint}` }))}
                disabled={Boolean(training)}
                hint={training ? 'Độ khó được khóa theo bài luyện.' : undefined}
              />
            </div>
            <div className="mt-4">
              <Slider
                label="Mức độ chủ động của học sinh"
                value={activity}
                onChange={setActivity}
                min={10}
                max={95}
                step={5}
                suffix="%"
                hint="Ảnh hưởng đến tần suất giơ tay và phản hồi tự phát của học sinh AI."
              />
            </div>
            <div className="mt-4">
              <p className="mb-1.5 text-[13px] font-semibold text-[var(--text)]">Tần suất phản hồi trực tiếp</p>
              <div className="flex gap-1.5">
                {[
                  { value: 'low', label: 'Ít' },
                  { value: 'normal', label: 'Vừa' },
                  { value: 'high', label: 'Nhiều' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFeedbackFrequency(item.value as typeof feedbackFrequency)}
                    className={cn(
                      'flex-1 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-all',
                      feedbackFrequency === item.value
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                        : 'border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-2)]',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeader
              title="5. Ghi hình và quyền riêng tư"
              description="Mặc định tắt. Chỉ ghi khi bạn chủ động bật."
              icon={<ShieldCheck className="h-5 w-5" />}
            />
            <div className="mt-3">
              <Switch
                checked={recordingEnabled}
                onChange={setRecordingEnabled}
                label="Ghi hình/ghi âm cục bộ cho buổi luyện"
                description="Bản ghi được lưu trong IndexedDB trên máy này, không tải lên máy chủ. Bạn có thể xóa cùng buổi luyện sau đó."
              />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                { icon: Camera, text: 'Video không rời khỏi thiết bị.' },
                { icon: Mic, text: 'Micro chỉ bật sau khi bạn bấm nút.' },
                { icon: ShieldCheck, text: 'Không nhận diện danh tính/cảm xúc.' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.text} className="flex items-start gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2">
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" />
                    <span className="text-[10.5px] leading-relaxed text-[var(--text-2)]">{item.text}</span>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <GlassCard tone="accent">
            <SectionHeader title="Tóm tắt buổi luyện" icon={<MonitorPlay className="h-5 w-5" />} />
            <dl className="mt-3 space-y-2.5 text-[12px]">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--muted)]">Bài dạy</dt>
                <dd className="max-w-[65%] text-right font-semibold text-[var(--text)]">
                  {selectedLesson?.title ?? 'Chưa chọn'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--muted)]">Chế độ</dt>
                <dd className="font-semibold text-[var(--text)]">{MODE_LABELS[mode]}</dd>
              </div>
              {mode === 'scenario' && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--muted)]">Tình huống</dt>
                  <dd className="font-semibold text-[var(--text)]">{SCENARIO_LABELS[scenario]}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--muted)]">Học sinh</dt>
                <dd className="font-semibold text-[var(--text)]">
                  {Math.min(studentCount, realStudents.length)} bạn AI
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--muted)]">Độ khó</dt>
                <dd className="font-semibold text-[var(--text)]">
                  {DIFFICULTIES.find((item) => item.value === difficulty)?.label}
                </dd>
              </div>
              {estimatedDuration > 0 && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--muted)]">Thời lượng dự kiến</dt>
                  <dd className="inline-flex items-center gap-1 font-semibold text-[var(--text)]">
                    <Clock3 className="h-3.5 w-3.5" /> ~{formatDuration(estimatedDuration)}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--muted)]">Bài trình chiếu</dt>
                <dd className="font-semibold text-[var(--text)]">
                  {presentation ? `${presentation.slides.length} slide` : 'Chưa tải (tuỳ chọn)'}
                </dd>
              </div>
              {presentation && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--muted)]">Bản hiển thị</dt>
                  <dd className="font-semibold text-[var(--text)]">
                    {presentation.visualMode === 'pdf' ? 'PDF gốc (giống PowerPoint)' : 'Mô phỏng từ PPTX'}
                  </dd>
                </div>
              )}
              {presentation && (
                <div className="flex items-start justify-between gap-3">
                  <dt className="shrink-0 text-[var(--muted)]">Bố cục slide</dt>
                  <dd className="max-w-[65%] text-right font-semibold text-[var(--text)]">
                    {PRESENTATION_LAYOUT_LABELS[settings.presentationLayout]}
                  </dd>
                </div>
              )}
              {training && (
                <div className="flex items-start justify-between gap-3 border-t border-[var(--border-soft)] pt-2.5">
                  <dt className="text-[var(--muted)]">Bài luyện</dt>
                  <dd className="max-w-[65%] text-right font-semibold text-[var(--text)]">{training.title}</dd>
                </div>
              )}
            </dl>

            <div className="mt-4 space-y-1.5">
              {[
                { ok: Boolean(selectedLesson), text: 'Đã chọn kế hoạch bài dạy' },
                { ok: selectedLesson?.parsingStatus === 'confirmed', text: 'Kế hoạch đã xác nhận' },
                { ok: realStudents.length > 0, text: 'Có hồ sơ học sinh AI' },
                { ok: studentCount > 0, text: 'Số học sinh hợp lệ' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-1.5 text-[11.5px]">
                  <span className={item.ok ? 'text-[var(--success)]' : 'text-[var(--muted)]'}>
                    {item.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="block h-3.5 w-3.5 rounded-full border border-current" />}
                  </span>
                  <span className={item.ok ? 'text-[var(--text)]' : 'text-[var(--text-2)]'}>{item.text}</span>
                </div>
              ))}
            </div>

            {!realStudents.length && (
              <div className="mt-3 rounded-xl bg-[var(--warning-soft)] px-3 py-2 text-[11.5px] leading-relaxed text-[var(--warning)]">
                Chưa có học sinh AI.{' '}
                <Link to="/classroom" className="font-bold underline">
                  Thêm hồ sơ
                </Link>{' '}
                để lớp học có người tương tác.
              </div>
            )}

            <Button
              className="mt-4"
              variant="primary"
              fullWidth
              size="lg"
              icon={<Play className="h-4 w-4" />}
              iconRight={<ArrowRight className="h-4 w-4" />}
              loading={starting}
              disabled={!canStart}
              onClick={() => void handleStart()}
            >
              Bắt đầu buổi luyện
            </Button>
            <p className="mt-2 text-center text-[10.5px] leading-relaxed text-[var(--muted)]">
              Buổi luyện chỉ bắt đầu sau khi bạn bấm nút trong phòng học. Camera/micro không tự bật.
            </p>
          </GlassCard>

          {training && (
            <GlassCard>
              <SectionHeader title="Tiêu chí của bài luyện" description="Kết quả tính từ dữ liệu thực." />
              <ul className="mt-2.5 space-y-1.5">
                {training.criteria.map((criterion) => (
                  <li key={criterion.id} className="flex items-start gap-2 text-[11.5px] text-[var(--text-2)]">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
                    {criterion.label}
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}

          <GlassCard>
            <SectionHeader title="Trước khi bắt đầu" icon={<AlertTriangle className="h-5 w-5" />} />
            <ul className="mt-2.5 space-y-1.5 text-[11.5px] leading-relaxed text-[var(--text-2)]">
              <li>Đặt laptop ở vị trí ổn định, đủ ánh sáng và thấy rõ đầu, vai, hông nếu muốn phân tích tư thế.</li>
              <li>Kiểm tra micro ở khoảng cách 50–70 cm, tránh quạt hoặc tiếng ồn lớn.</li>
              <li>Không phải lúc nào cũng cần camera. Bạn có thể luyện chỉ với micro và nhập lời giảng thủ công.</li>
              <li>Browsers hỗ trợ nhận dạng giọng nói tốt nhất: Chrome hoặc Edge trên máy tính.</li>
            </ul>
            <Button variant="soft" size="sm" fullWidth className="mt-3" icon={<Camera className="h-3.5 w-3.5" />} onClick={() => setDeviceModalOpen(true)}>
              Kiểm tra camera & micro
            </Button>
          </GlassCard>
        </div>
      </div>

      <Modal
        open={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        title="Kiểm tra camera và micro"
        description="Chỉ bật khi bạn bấm. Đóng cửa sổ này sẽ tắt thiết bị kiểm tra."
        size="xl"
        footer={<Button onClick={() => setDeviceModalOpen(false)}>Đóng và tiếp tục</Button>}
      >
        <DeviceCheckPanel compact />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-[var(--surface-muted)] p-3">
            <p className="text-[11.5px] font-bold text-[var(--text)]">Gợi ý đặt camera</p>
            <ul className="mt-1 space-y-0.5 text-[10.5px] leading-relaxed text-[var(--text-2)]">
              <li>• Đặt laptop cố định, không cầm tay.</li>
              <li>• Giữ khoảng cách để thấy đầu, vai và hông.</li>
              <li>• Tránh ngược sáng mạnh từ cửa sổ.</li>
            </ul>
          </div>
          <div className="rounded-xl bg-[var(--surface-muted)] p-3">
            <p className="text-[11.5px] font-bold text-[var(--text)]">Gợi ý đặt micro</p>
            <ul className="mt-1 space-y-0.5 text-[10.5px] leading-relaxed text-[var(--text-2)]">
              <li>• Cách miệng 50–70 cm.</li>
              <li>• Nói thử và xem thanh âm lượng chuyển động.</li>
              <li>• Tắt quạt hoặc nguồn ồn lớn nếu có thể.</li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
}
