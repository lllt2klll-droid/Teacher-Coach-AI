import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  Dumbbell,
  FileText,
  MonitorPlay,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  UsersRound,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/ui/Display';
import { Badge, GlassCard, SectionHeader, StatCard, EmptyState, LoadingState } from '@/components/ui/Display';
import { Button } from '@/components/ui/Button';
import { CoachBot } from '@/components/brand/Mascot';
import { usePageTitle } from '@/hooks/usePageTitle';
import { lessonRepo, profileRepo, reportRepo, sessionRepo, trainingRepo } from '@/data/repositories';
import { average } from '@/lib/utils';
import { formatClock, formatDate, formatRelative } from '@/lib/format';
import { hasDemoData } from '@/data/seed';
import { useState } from 'react';
import { useEffect } from 'react';

const QUICK_ACTIONS = [
  {
    to: '/lessons/upload',
    label: 'Tải KHBD',
    description: 'PDF, DOCX hoặc TXT',
    icon: Upload,
    tone: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
  },
  {
    to: '/practice',
    label: 'Bắt đầu luyện',
    description: 'Lớp học AI mô phỏng',
    icon: MonitorPlay,
    tone: 'bg-[var(--lavender-soft)] text-[var(--lavender)]',
  },
  {
    to: '/classroom',
    label: 'Lớp học AI',
    description: 'Xem và chỉnh học sinh',
    icon: UsersRound,
    tone: 'bg-[var(--success-soft)] text-[var(--success)]',
  },
  {
    to: '/reports',
    label: 'Xem báo cáo',
    description: 'Bằng chứng từ dữ liệu thật',
    icon: BarChart3,
    tone: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 14) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export function DashboardPage() {
  usePageTitle('Tổng quan');
  const navigate = useNavigate();
  const profile = useLiveQuery(() => profileRepo.get(), []);
  const lessons = useLiveQuery(() => lessonRepo.list(), []);
  const sessions = useLiveQuery(() => sessionRepo.list(), []);
  const reports = useLiveQuery(() => reportRepo.list(), []);
  const trainingResults = useLiveQuery(() => trainingRepo.list(), []);
  const [demoExists, setDemoExists] = useState(false);

  useEffect(() => {
    void hasDemoData().then(setDemoExists).catch(() => setDemoExists(false));
  }, [lessons]);

  const loading = !lessons || !sessions || !reports || !trainingResults;

  const realLessons = useMemo(() => (lessons ?? []).filter((lesson) => !lesson.isDemo), [lessons]);
  const realSessions = useMemo(() => (sessions ?? []).filter((session) => !session.isDemo), [sessions]);
  const realReports = useMemo(() => (reports ?? []).filter((report) => !report.isDemo), [reports]);
  const scoredReports = useMemo(
    () => realReports.filter((report) => report.overallScore !== null),
    [realReports],
  );
  const averageScore = average(scoredReports.map((report) => report.overallScore as number));
  const totalTrainingMinutes = Math.round(
    realSessions.reduce((sum, session) => sum + session.durationSec, 0) / 60,
  );
  const completedTraining = (trainingResults ?? []).filter((result) => result.passed === true).length;
  const needsReview = realLessons.filter(
    (lesson) => lesson.parsingStatus === 'needs_review' || lesson.parsingStatus === 'failed',
  );
  const interrupted = realSessions.filter(
    (session) => session.status === 'active' || session.status === 'paused',
  );
  const demoLesson = (lessons ?? []).find((lesson) => lesson.isDemo);

  const nextStep = useMemo(() => {
    if (!realLessons.length) {
      return {
        title: 'Tải kế hoạch bài dạy đầu tiên',
        description: 'Tải file PDF, DOCX hoặc dán nội dung để hệ thống trích xuất mục tiêu và các hoạt động.',
        cta: 'Tải kế hoạch bài dạy',
        to: '/lessons/upload',
        icon: Upload,
      };
    }
    if (needsReview.length) {
      return {
        title: 'Hoàn tất kiểm tra kế hoạch bài dạy',
        description: `Có ${needsReview.length} kế hoạch cần bạn xác nhận trước khi luyện tập.`,
        cta: 'Kiểm tra ngay',
        to: `/lessons/${needsReview[0].id}/review`,
        icon: FileText,
      };
    }
    if (interrupted.length) {
      return {
        title: 'Khôi phục buổi luyện bị gián đoạn',
        description: 'Dữ liệu đã ghi vẫn nằm trên thiết bị. Bạn có thể tạo báo cáo từ dữ liệu đó.',
        cta: 'Khôi phục',
        to: `/practice/${interrupted[0].id}/live`,
        icon: AlertTriangle,
      };
    }
    if (!realSessions.length) {
      return {
        title: 'Bắt đầu buổi luyện đầu tiên',
        description: 'Chọn kế hoạch bài dạy, bật camera/micro nếu muốn và bắt đầu tương tác với lớp học AI.',
        cta: 'Bắt đầu luyện tập',
        to: '/practice',
        icon: MonitorPlay,
      };
    }
    return {
      title: 'Tiếp tục xây dựng kỹ năng giảng dạy',
      description:
        realReports.length > 0
          ? 'Xem lại báo cáo gần nhất và chọn một điểm cần cải thiện để luyện tiếp.'
          : 'Hoàn thành buổi luyện và tạo báo cáo để nhận gợi ý dựa trên bằng chứng.',
      cta: realReports.length ? 'Xem báo cáo gần nhất' : 'Bắt đầu luyện',
      to: realReports.length ? `/reports/${realReports[0].id}` : '/practice',
      icon: realReports.length ? BarChart3 : Play,
    };
  }, [interrupted, needsReview, realLessons, realReports, realSessions.length]);

  const chartData = useMemo(
    () =>
      scoredReports
        .slice(0, 6)
        .reverse()
        .map((report, index) => ({
          name: `Lần ${index + 1}`,
          date: formatDate(report.createdAt),
          score: report.overallScore,
        })),
    [scoredReports],
  );

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Tổng quan" description="Đang tải dữ liệu lưu trên thiết bị…" />
        <LoadingState />
      </div>
    );
  }

  const NextIcon = nextStep.icon;

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title={`${greeting()}, ${profile?.displayName || 'bạn'}!`}
        description={new Intl.DateTimeFormat('vi-VN', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }).format(new Date())}
        eyebrow="Không gian luyện tập"
        actions={
          <Button
            variant="primary"
            size="md"
            icon={<MonitorPlay className="h-4 w-4" />}
            onClick={() => navigate('/practice')}
          >
            Bắt đầu luyện tập
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <GlassCard padding="none" className="relative overflow-hidden p-5 md:p-6">
          <div className="pointer-events-none absolute -right-10 -top-14 h-56 w-56 rounded-full bg-[var(--accent-soft)] blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 right-20 h-44 w-44 rounded-full bg-[var(--lavender-soft)] blur-2xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <Badge tone="accent" icon={<Sparkles className="h-3 w-3" />}>
                Gợi ý tiếp theo
              </Badge>
              <h2 className="mt-3 font-display text-xl font-bold text-[var(--text)] md:text-[23px]">{nextStep.title}</h2>
              <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-[var(--text-2)]">{nextStep.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  icon={<NextIcon className="h-4 w-4" />}
                  iconRight={<ArrowRight className="h-4 w-4" />}
                  onClick={() => navigate(nextStep.to)}
                >
                  {nextStep.cta}
                </Button>
                <Button variant="ghost" onClick={() => navigate('/lessons')}>
                  Mở thư viện
                </Button>
              </div>
            </div>
            <div className="hidden shrink-0 sm:block">
              <CoachBot size={148} mood="waving" />
            </div>
          </div>
        </GlassCard>

        <GlassCard tone="accent" className="flex flex-col justify-between">
          <div>
            <SectionHeader
              title="Tiến bộ có bằng chứng"
              description="Chỉ tính các buổi luyện thật, không gồm dữ liệu DEMO."
              icon={<TrendingUp className="h-5 w-5" />}
            />
            {chartData.length >= 2 ? (
              <div className="mt-3 h-[130px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 6, right: 4, left: -26, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashboardScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => [`${value}/100`, 'Điểm tổng']} labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''} />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="var(--accent-strong)"
                      strokeWidth={2.5}
                      fill="url(#dashboardScore)"
                      dot={{ r: 3, fill: 'var(--accent)', strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-3 rounded-xl bg-[var(--surface-muted)] px-3.5 py-4">
                <p className="text-[12px] font-semibold text-[var(--text)]">
                  {scoredReports.length === 0 ? 'Chưa có điểm tổng từ buổi luyện thật' : 'Cần thêm một buổi có điểm'}
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--text-2)]">
                  Biểu đồ tiến bộ chỉ xuất hiện khi có ít nhất hai báo cáo có đủ dữ liệu. Hệ thống không tạo xu hướng giả.
                </p>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">Điểm trung bình</p>
              <p className="font-display text-2xl font-bold text-[var(--text)]">
                {averageScore === null ? '—' : `${Math.round(averageScore)}/100`}
              </p>
            </div>
            <Badge tone={averageScore === null ? 'neutral' : 'success'}>
              {scoredReports.length} báo cáo có điểm
            </Badge>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Thời lượng đã luyện"
          value={`${totalTrainingMinutes} phút`}
          hint={`${realSessions.filter((s) => s.status === 'completed').length} buổi hoàn thành`}
          icon={<Clock3 className="h-5 w-5" />}
          tone="accent"
          onClick={() => navigate('/reports')}
        />
        <StatCard
          label="Kế hoạch bài dạy"
          value={`${realLessons.length}`}
          hint={needsReview.length ? `${needsReview.length} cần kiểm tra` : 'Tất cả đã xác nhận'}
          icon={<BookOpen className="h-5 w-5" />}
          tone="violet"
          onClick={() => navigate('/lessons')}
        />
        <StatCard
          label="Báo cáo thật"
          value={`${realReports.length}`}
          hint={`${scoredReports.length} có điểm tổng`}
          icon={<BarChart3 className="h-5 w-5" />}
          tone="green"
          onClick={() => navigate('/reports')}
        />
        <StatCard
          label="Bài luyện đạt"
          value={`${completedTraining}`}
          hint={`${(trainingResults ?? []).length} kết quả đã lưu`}
          icon={<Dumbbell className="h-5 w-5" />}
          tone="amber"
          onClick={() => navigate('/training')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <GlassCard>
          <SectionHeader
            title="Buổi luyện gần đây"
            description="Dữ liệu thật trên thiết bị này."
            icon={<Clock3 className="h-5 w-5" />}
            action={
              <Link to="/reports" className="text-[12px] font-semibold text-[var(--accent-strong)] hover:underline">
                Xem tất cả
              </Link>
            }
          />
          {realSessions.length === 0 ? (
            <EmptyState
              compact
              icon={<MonitorPlay className="h-6 w-6" />}
              title="Chưa có buổi luyện nào"
              description="Bắt đầu một buổi luyện để hệ thống ghi nhận dữ liệu thật từ micro, camera và lớp học AI."
              action={
                <Button size="sm" icon={<Play className="h-4 w-4" />} onClick={() => navigate('/practice')}>
                  Bắt đầu ngay
                </Button>
              }
            />
          ) : (
            <div className="mt-3 space-y-2">
              {realSessions.slice(0, 5).map((session) => {
                const report = realReports.find((item) => item.sessionId === session.id);
                const interruptedSession = session.status === 'active' || session.status === 'paused';
                const target = report
                  ? `/reports/${report.id}`
                  : interruptedSession || session.status === 'ready'
                    ? `/practice/${session.id}/live`
                    : '/reports';
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => navigate(target)}
                    className="pressable flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2.5 text-left transition-colors hover:border-[var(--border-soft)] hover:bg-[var(--accent-softer)]"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                      <MonitorPlay className="h-4.5 w-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{session.lessonTitle}</span>
                      <span className="block text-[11px] text-[var(--muted)]">
                        {formatRelative(session.startedAt)} · {formatClock(session.durationSec)}
                        {session.cameraAvailable ? ' · có camera' : ''}
                        {session.transcriptAvailable ? ' · có lời giảng' : ''}
                      </span>
                    </span>
                    {interruptedSession ? (
                      <Badge tone="warning">Gián đoạn</Badge>
                    ) : report ? (
                      <Badge tone="success">{report.overallScore === null ? 'Đã có báo cáo' : `${report.overallScore}/100`}</Badge>
                    ) : session.status === 'completed' ? (
                      <Badge tone="warning">Thiếu báo cáo</Badge>
                    ) : (
                      <Badge tone="accent">Chưa bắt đầu</Badge>
                    )}
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                  </button>
                );
              })}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <SectionHeader
            title="Thao tác nhanh"
            description="Mở đúng nơi bạn cần."
            icon={<Target className="h-5 w-5" />}
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3 transition-all hover:-translate-y-0.5 hover:border-[var(--accent)]/30 hover:bg-[var(--surface-solid)]"
                >
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${action.tone}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <p className="mt-2 text-[12.5px] font-bold text-[var(--text)]">{action.label}</p>
                  <p className="text-[10.5px] leading-tight text-[var(--muted)]">{action.description}</p>
                </Link>
              );
            })}
          </div>
          {(realReports[0]?.improvements.length ?? 0) > 0 && (
            <div className="mt-3 rounded-xl bg-[var(--warning-soft)] p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--warning)]">
                <AlertTriangle className="h-3.5 w-3.5" /> Từ báo cáo gần nhất
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--text-2)]">
                {realReports[0].improvements[0].title}
              </p>
              <Link
                to={`/reports/${realReports[0].id}`}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-strong)]"
              >
                Xem bằng chứng <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </GlassCard>
      </div>

      {demoLesson && (
        <GlassCard className="border-dashed">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--warning-soft)] text-[var(--warning)]">
                <BookOpen className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-[14.5px] font-bold text-[var(--text)]">{demoLesson.title}</h3>
                  <Badge tone="demo">DEMO</Badge>
                </div>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--text-2)]">
                  Bài học mẫu để bạn thử quy trình. Bài này <strong>không được tính</strong> vào thống kê, không tạo buổi
                  luyện hay điểm giả. Bạn có thể xóa trong Cài đặt.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" size="sm" onClick={() => navigate(`/lessons/${demoLesson.id}/review`)}>
                Xem bài DEMO
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/practice?lesson=${demoLesson.id}`)}
              >
                Dùng để thử
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {demoExists === false && !demoLesson && (
        <p className="px-1 text-[11px] text-[var(--muted)]">
          Bài học DEMO đã được xóa. Bạn có thể khôi phục trong Cài đặt → Dữ liệu.
        </p>
      )}

      {realReports.length > 0 && (
        <GlassCard>
          <SectionHeader
            title="Điểm cần chú ý từ bằng chứng"
            description="Lấy trực tiếp từ mục “Cần cải thiện” của báo cáo gần nhất."
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {realReports[0].improvements.slice(0, 4).map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-xl bg-[var(--surface-muted)] p-3">
                <p className="text-[12px] font-semibold text-[var(--text)]">{item.title}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--text-2)]">{item.detail}</p>
              </div>
            ))}
            {realReports[0].improvements.length === 0 && (
              <p className="text-[12px] text-[var(--text-2)]">Báo cáo này chưa ghi nhận điểm cần cải thiện cụ thể.</p>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
