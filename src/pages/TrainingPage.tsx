import { useDeferredValue, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  ArrowRight,
  AudioLines,
  BarChart3,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Dumbbell,
  Eye,
  MessageCircleQuestion,
  MessageSquareText,
  Mic,
  Play,
  PlayCircle,
  PersonStanding,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  EmptyState,
  GlassCard,
  LoadingState,
  PageHeader,
  Progress,
  SectionHeader,
  StatCard,
} from '@/components/ui/Display';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Inputs';
import { InfoNote, Modal } from '@/components/ui/Overlay';
import { usePageTitle } from '@/hooks/usePageTitle';
import { reportRepo, sessionRepo, trainingRepo } from '@/data/repositories';
import { TRAINING_EXERCISES, TRAINING_GROUPS, getTrainingExercise } from '@/data/training-exercises';
import { formatCriterionTarget } from '@/services/training/evaluate-training';
import { normalizeSearch } from '@/components/layout/AppShell';
import { TRAINING_GROUP_LABELS, formatDate, formatDuration, formatRelative } from '@/lib/format';
import { average } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { TrainingExercise, TrainingGroup, TrainingResult } from '@/types/domain';

const GROUP_ICONS: Record<TrainingGroup, typeof AudioLines> = {
  voice: AudioLines,
  posture: PersonStanding,
  questioning: MessageCircleQuestion,
  language: MessageSquareText,
  opening: PlayCircle,
  transition: ArrowRight,
  situations: AlertTriangle,
  interaction: UsersRound,
};

const DIFFICULTY_LABELS = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' } as const;

function needsCamera(exercise: TrainingExercise): boolean {
  return exercise.criteria.some((criterion) =>
    ['posture_visibility', 'posture_stability', 'gesture_rate'].includes(criterion.metric),
  );
}

function needsMic(exercise: TrainingExercise): boolean {
  return exercise.criteria.some((criterion) =>
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
}

function passTone(passed: boolean | null): 'success' | 'danger' | 'neutral' {
  if (passed === true) return 'success';
  if (passed === false) return 'danger';
  return 'neutral';
}

function passLabel(passed: boolean | null): string {
  if (passed === true) return 'Đạt';
  if (passed === false) return 'Chưa đạt';
  return 'Chưa đủ dữ liệu';
}

function ResultRow({
  result,
  reportId,
  demo,
}: {
  result: TrainingResult;
  reportId?: string;
  demo: boolean;
}) {
  const navigate = useNavigate();
  const met = result.criteriaResults.filter((criterion) => criterion.met === true).length;
  const missing = result.criteriaResults.filter((criterion) => criterion.met === null).length;
  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[12.5px] font-bold text-[var(--text)]">{result.exerciseTitle}</p>
            {demo && <Badge tone="demo">DEMO</Badge>}
            <Badge tone={passTone(result.passed)}>{passLabel(result.passed)}</Badge>
          </div>
          <p className="mt-0.5 text-[10.5px] text-[var(--muted)]">
            {formatDate(result.completedAt, true)} · {formatDuration(Math.max(1, Math.round(result.durationSec / 60)))} ·
            Điểm tiêu chí {result.score === null ? '—' : `${result.score}/100`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {reportId && (
            <Button
              size="xs"
              variant="secondary"
              icon={<BarChart3 className="h-3 w-3" />}
              onClick={() => navigate(`/reports/${reportId}`)}
            >
              Báo cáo
            </Button>
          )}
          <Button
            size="xs"
            variant="ghost"
            iconRight={<ArrowRight className="h-3 w-3" />}
            onClick={() => navigate(`/practice?training=${result.exerciseId}`)}
          >
            Luyện lại
          </Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-[var(--success)]" /> {met} đạt
        </span>
        <span className="inline-flex items-center gap-1">
          <XCircle className="h-3 w-3 text-[var(--danger)]" />{' '}
          {result.criteriaResults.filter((criterion) => criterion.met === false).length} chưa đạt
        </span>
        {missing > 0 && (
          <span className="inline-flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-[var(--warning)]" /> {missing} thiếu dữ liệu
          </span>
        )}
      </div>
      {missing > 0 && (
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">
          Tiêu chí thiếu dữ liệu không được tính là đạt. Hãy bật micro/camera hoặc nhập lời giảng khi luyện lại.
        </p>
      )}
    </div>
  );
}

export function TrainingPage() {
  usePageTitle('Trung tâm luyện tập');
  const navigate = useNavigate();
  const results = useLiveQuery(() => trainingRepo.list(), []);
  const sessions = useLiveQuery(() => sessionRepo.list(), []);
  const reports = useLiveQuery(() => reportRepo.list(), []);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [group, setGroup] = useState<TrainingGroup | 'all'>('all');
  const [selected, setSelected] = useState<TrainingExercise | null>(null);
  const [resultFilter, setResultFilter] = useState<'all' | 'passed' | 'not_passed'>('all');

  const loading = results === undefined || sessions === undefined || reports === undefined;
  const allResults = results ?? [];
  const realResults = useMemo(() => allResults.filter((result) => !result.isDemo), [allResults]);
  const demoResults = useMemo(() => allResults.filter((result) => result.isDemo), [allResults]);
  const scored = realResults.filter((result) => result.score !== null);
  const avgScore = average(scored.map((result) => result.score as number));
  const passedCount = realResults.filter((result) => result.passed === true).length;
  const totalMinutes = Math.round(realResults.reduce((sum, result) => sum + result.durationSec, 0) / 60);

  const sessionById = useMemo(() => new Map((sessions ?? []).map((session) => [session.id, session])), [sessions]);
  const reportBySession = useMemo(
    () => new Map((reports ?? []).map((report) => [report.sessionId, report])),
    [reports],
  );

  const attemptByExercise = useMemo(() => {
    const map = new Map<string, { attempts: number; best: number | null; passed: boolean | null }>();
    for (const result of realResults) {
      const current = map.get(result.exerciseId) ?? { attempts: 0, best: null, passed: null };
      map.set(result.exerciseId, {
        attempts: current.attempts + 1,
        best:
          result.score === null
            ? current.best
            : current.best === null
              ? result.score
              : Math.max(current.best, result.score),
        passed: current.passed === true ? true : result.passed,
      });
    }
    return map;
  }, [realResults]);

  const filteredExercises = useMemo(() => {
    const needle = normalizeSearch(deferredQuery);
    return TRAINING_EXERCISES.filter((exercise) => {
      if (group !== 'all' && exercise.group !== group) return false;
      if (!needle) return true;
      return normalizeSearch(
        `${exercise.title} ${exercise.description} ${exercise.objective} ${TRAINING_GROUP_LABELS[exercise.group]}`,
      ).includes(needle);
    });
  }, [deferredQuery, group]);

  const filteredResults = useMemo(() => {
    return realResults.filter((result) => {
      if (resultFilter === 'passed') return result.passed === true;
      if (resultFilter === 'not_passed') return result.passed !== true;
      return true;
    });
  }, [realResults, resultFilter]);

  const groupedExercises = useMemo(() => {
    const map = new Map<TrainingGroup, TrainingExercise[]>();
    for (const exercise of filteredExercises) {
      const list = map.get(exercise.group) ?? [];
      list.push(exercise);
      map.set(exercise.group, list);
    }
    return Array.from(map.entries());
  }, [filteredExercises]);

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Trung tâm luyện tập" description="Đang tải bài luyện và kết quả trên thiết bị…" />
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="Trung tâm luyện tập"
        eyebrow="Kỹ năng có tiêu chí đo được"
        description="Mỗi bài luyện gắn với tiêu chí lấy từ dữ liệu thật của buổi luyện: micro, camera, lời giảng và sự kiện lớp học. Không có điểm ngẫu nhiên."
        icon={<Dumbbell className="h-6 w-6" />}
        actions={
          <Button variant="primary" icon={<Play className="h-4 w-4" />} onClick={() => navigate('/practice')}>
            Luyện tự do
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Bài luyện đã hoàn thành"
          value={`${realResults.length}`}
          hint={`${TRAINING_EXERCISES.length} bài luyện có sẵn`}
          icon={<Dumbbell className="h-5 w-5" />}
          tone="accent"
        />
        <StatCard
          label="Đạt tiêu chí"
          value={`${passedCount}`}
          hint={realResults.length ? `${Math.round((passedCount / realResults.length) * 100)}% số lần luyện` : 'Chưa có kết quả'}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="green"
        />
        <StatCard
          label="Điểm tiêu chí trung bình"
          value={avgScore === null ? '—' : `${Math.round(avgScore)}/100`}
          hint={`${scored.length} kết quả đủ dữ liệu chấm`}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="violet"
        />
        <StatCard
          label="Thời lượng luyện"
          value={`${totalMinutes} phút`}
          hint="Chỉ tính kết quả thật, không gồm DEMO"
          icon={<Clock3 className="h-5 w-5" />}
          tone="amber"
        />
      </div>

      <InfoNote>
        Bài luyện chỉ đánh giá khi có dữ liệu tương ứng. Ví dụ: tiêu chí tư thế cần camera; tiêu chí giọng nói cần micro
        hoặc lời giảng nhập tay. Tiêu chí thiếu dữ liệu được ghi rõ là “chưa đủ dữ liệu”, không tự động cho đạt.
      </InfoNote>

      <GlassCard>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <Input
            label="Tìm bài luyện"
            placeholder="Ví dụ: giọng nói, đặt câu hỏi, xử lý tình huống…"
            leading={<Search className="h-4 w-4" />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1"
          />
          <Select
            label="Nhóm kỹ năng"
            value={group}
            onChange={(event) => setGroup(event.target.value as TrainingGroup | 'all')}
            options={[
              { value: 'all', label: `Tất cả nhóm (${TRAINING_EXERCISES.length})` },
              ...TRAINING_GROUPS.map((item) => ({
                value: item,
                label: `${TRAINING_GROUP_LABELS[item]} (${TRAINING_EXERCISES.filter((exercise) => exercise.group === item).length})`,
              })),
            ]}
            className="min-w-[220px]"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setGroup('all')}
            className={cn(
              'rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors',
              group === 'all'
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                : 'border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-2)] hover:border-[var(--accent)]/35',
            )}
          >
            Tất cả
          </button>
          {TRAINING_GROUPS.map((item) => {
            const Icon = GROUP_ICONS[item];
            return (
              <button
                key={item}
                type="button"
                onClick={() => setGroup(item)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors',
                  group === item
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                    : 'border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-2)] hover:border-[var(--accent)]/35',
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {TRAINING_GROUP_LABELS[item]}
              </button>
            );
          })}
        </div>
      </GlassCard>

      {filteredExercises.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="Không tìm thấy bài luyện phù hợp"
            description="Thử từ khóa khác hoặc chọn lại nhóm kỹ năng."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('');
                  setGroup('all');
                }}
              >
                Xóa bộ lọc
              </Button>
            }
          />
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {groupedExercises.map(([groupKey, exercises]) => {
            const GroupIcon = GROUP_ICONS[groupKey];
            return (
              <section key={groupKey}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                    <GroupIcon className="h-4 w-4" />
                  </span>
                  <h2 className="font-display text-[16px] font-bold text-[var(--text)]">{TRAINING_GROUP_LABELS[groupKey]}</h2>
                  <Badge tone="neutral">{exercises.length}</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {exercises.map((exercise) => {
                    const attempt = attemptByExercise.get(exercise.id);
                    const camera = needsCamera(exercise);
                    const mic = needsMic(exercise);
                    return (
                      <GlassCard key={exercise.id} hover className="flex flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--lavender-soft)] text-[var(--lavender)]">
                            <Target className="h-4 w-4" />
                          </span>
                          <div className="flex flex-wrap justify-end gap-1">
                            <Badge tone={exercise.difficulty === 'hard' ? 'danger' : exercise.difficulty === 'medium' ? 'warning' : 'success'}>
                              {DIFFICULTY_LABELS[exercise.difficulty]}
                            </Badge>
                            {attempt?.passed === true && <Badge tone="success">Đã đạt</Badge>}
                          </div>
                        </div>
                        <h3 className="mt-2 font-display text-[14px] font-bold leading-snug text-[var(--text)]">{exercise.title}</h3>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-2)]">
                          {exercise.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-[var(--muted)]">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-0.5">
                            <Clock3 className="h-3 w-3" /> {exercise.durationMin} phút
                          </span>
                          {camera && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--lavender-soft)] px-2 py-0.5 text-[var(--lavender)]">
                              <Camera className="h-3 w-3" /> Camera
                            </span>
                          )}
                          {mic && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent-strong)]">
                              <Mic className="h-3 w-3" /> Micro
                            </span>
                          )}
                          {exercise.usesStudents && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[var(--success)]">
                              <UsersRound className="h-3 w-3" /> Học sinh AI
                            </span>
                          )}
                        </div>
                        {attempt ? (
                          <div className="mt-2.5">
                            <Progress value={attempt.best ?? 0} tone={attempt.passed ? 'success' : 'warning'} size="sm" />
                            <p className="mt-1 text-[10px] text-[var(--muted)]">
                              {attempt.attempts} lần luyện
                              {attempt.best === null ? ' · chưa đủ dữ liệu chấm' : ` · tốt nhất ${Math.round(attempt.best)}/100`}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-2.5 text-[10px] text-[var(--muted)]">Chưa luyện bài này.</p>
                        )}
                        <div className="mt-auto flex gap-1.5 pt-3">
                          <Button size="sm" variant="ghost" fullWidth onClick={() => setSelected(exercise)}>
                            Xem tiêu chí
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            fullWidth
                            icon={<Play className="h-3.5 w-3.5" />}
                            onClick={() => navigate(`/practice?training=${exercise.id}`)}
                          >
                            Luyện
                          </Button>
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <GlassCard>
        <SectionHeader
          title="Kết quả luyện tập"
          description="Chỉ hiển thị kết quả thật trên thiết bị. Bạn có thể lọc theo trạng thái đạt."
          icon={<BarChart3 className="h-5 w-5" />}
          action={
            <Select
              value={resultFilter}
              onChange={(event) => setResultFilter(event.target.value as typeof resultFilter)}
              options={[
                { value: 'all', label: 'Tất cả kết quả' },
                { value: 'passed', label: 'Đã đạt' },
                { value: 'not_passed', label: 'Chưa đạt / thiếu dữ liệu' },
              ]}
              className="min-w-[190px]"
            />
          }
        />
        {filteredResults.length === 0 ? (
          <EmptyState
            compact
            icon={<Dumbbell className="h-6 w-6" />}
            title={realResults.length === 0 ? 'Chưa có kết quả luyện tập' : 'Không có kết quả phù hợp'}
            description={
              realResults.length === 0
                ? 'Chọn một bài luyện, hoàn thành buổi luyện và hệ thống sẽ chấm theo tiêu chí từ dữ liệu thật.'
                : 'Thử đổi bộ lọc kết quả.'
            }
            action={
              realResults.length === 0 ? (
                <Button size="sm" icon={<Play className="h-4 w-4" />} onClick={() => navigate('/practice')}>
                  Bắt đầu luyện
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setResultFilter('all')}>
                  Xem tất cả
                </Button>
              )
            }
          />
        ) : (
          <div className="mt-3 space-y-2">
            {filteredResults.slice(0, 12).map((result) => (
              <ResultRow
                key={result.id}
                result={result}
                reportId={
                  result.sessionId
                    ? reportBySession.get(result.sessionId)?.id
                    : undefined
                }
                demo={Boolean(result.isDemo || (result.sessionId && sessionById.get(result.sessionId)?.isDemo))}
              />
            ))}
            {filteredResults.length > 12 && (
              <p className="text-center text-[10.5px] text-[var(--muted)]">
                Đang hiển thị 12 kết quả mới nhất trong {filteredResults.length} kết quả.
              </p>
            )}
          </div>
        )}
      </GlassCard>

      {demoResults.length > 0 && (
        <GlassCard className="border-dashed">
          <SectionHeader
            title="Kết quả DEMO"
            description="Tách riêng khỏi thống kê thật. Bài DEMO chỉ để bạn thử quy trình."
            icon={<Eye className="h-5 w-5" />}
            action={<Badge tone="demo">{demoResults.length} kết quả</Badge>}
          />
          <div className="mt-3 space-y-2">
            {demoResults.slice(0, 5).map((result) => (
              <ResultRow
                key={result.id}
                result={result}
                reportId={result.sessionId ? reportBySession.get(result.sessionId)?.id : undefined}
                demo
              />
            ))}
          </div>
        </GlassCard>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <GlassCard>
          <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--text)]">
            <ShieldCheck className="h-4 w-4 text-[var(--success)]" /> Không có điểm ngẫu nhiên
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-2)]">
            Mọi tiêu chí đều truy vết được về số liệu của buổi luyện. Không đủ mẫu thì không chấm.
          </p>
        </GlassCard>
        <GlassCard>
          <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--text)]">
            <Mic className="h-4 w-4 text-[var(--accent-strong)]" /> Thiết bị là tùy chọn
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-2)]">
            Không bật camera/micro vẫn luyện được, nhưng tiêu chí cần dữ liệu tương ứng sẽ chưa đủ dữ liệu.
          </p>
        </GlassCard>
        <GlassCard>
          <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--text)]">
            <Sparkles className="h-4 w-4 text-[var(--lavender)]" /> Kết quả được lưu cục bộ
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-2)]">
            Kết quả nằm trong IndexedDB và có thể xuất trong Cài đặt. Bạn có thể xóa từng buổi luyện.
          </p>
        </GlassCard>
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.title ?? 'Bài luyện'}
        description={selected ? TRAINING_GROUP_LABELS[selected.group] : undefined}
        size="lg"
        footer={
          selected && (
            <>
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Đóng
              </Button>
              <Button
                icon={<Play className="h-4 w-4" />}
                iconRight={<ChevronRight className="h-4 w-4" />}
                onClick={() => navigate(`/practice?training=${selected.id}`)}
              >
                Chuẩn bị luyện
              </Button>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-[var(--text-2)]">{selected.description}</p>
            <div className="rounded-xl bg-[var(--accent-soft)] px-3.5 py-3">
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--accent-strong)]">Mục tiêu</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text)]">{selected.objective}</p>
            </div>
            <div>
              <p className="text-[12px] font-bold text-[var(--text)]">Cách luyện</p>
              <ol className="mt-1.5 space-y-1.5">
                {selected.instructions.map((instruction, index) => (
                  <li key={instruction} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-[var(--text-2)]">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--surface-muted)] text-[10px] font-bold text-[var(--text-2)]">
                      {index + 1}
                    </span>
                    {instruction}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-[12px] font-bold text-[var(--text)]">Tiêu chí đánh giá</p>
              <div className="mt-1.5 space-y-1.5">
                {selected.criteria.map((criterion) => (
                  <div
                    key={criterion.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2"
                  >
                    <span className="text-[11.5px] text-[var(--text)]">{criterion.label}</span>
                    <Badge tone="outline">{formatCriterionTarget(criterion)}</Badge>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="neutral" icon={<Clock3 className="h-3 w-3" />}>
                Khoảng {selected.durationMin} phút
              </Badge>
              <Badge tone={selected.difficulty === 'hard' ? 'danger' : selected.difficulty === 'medium' ? 'warning' : 'success'}>
                {DIFFICULTY_LABELS[selected.difficulty]}
              </Badge>
              {needsCamera(selected) && (
                <Badge tone="lavender" icon={<Camera className="h-3 w-3" />}>
                  Cần camera
                </Badge>
              )}
              {needsMic(selected) && (
                <Badge tone="accent" icon={<Mic className="h-3 w-3" />}>
                  Cần micro hoặc nhập lời giảng
                </Badge>
              )}
              {selected.usesStudents && (
                <Badge tone="success" icon={<UsersRound className="h-3 w-3" />}>
                  Cần học sinh AI
                </Badge>
              )}
            </div>
            {!getTrainingExercise(selected.id) && (
              <InfoNote tone="warning">Bài luyện này không còn trong danh mục hiện tại.</InfoNote>
            )}
          </div>
        )}
      </Modal>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[10.5px] text-[var(--muted)]">
          Bài luyện DEMO không được tính vào điểm trung bình, số bài đạt hay thống kê thật.
        </p>
        <Link to="/reports" className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--accent-strong)] hover:underline">
          Xem báo cáo <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
