import { useDeferredValue, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Dumbbell,
  FileWarning,
  MonitorPlay,
  PlayCircle,
  Search,
  Sparkles,
  TrendingUp,
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
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Inputs';
import { InfoNote } from '@/components/ui/Overlay';
import { usePageTitle } from '@/hooks/usePageTitle';
import { lessonRepo, reportRepo, sessionRepo, trainingRepo } from '@/data/repositories';
import { CATEGORY_SHORT, MODE_LABELS, formatClock, formatDate, formatRelative } from '@/lib/format';
import { average } from '@/lib/utils';
import { normalizeSearch } from '@/components/layout/AppShell';
import type { SessionReport } from '@/types/domain';
import { cn } from '@/lib/utils';

type ReportFilter = 'all' | 'scored' | 'insufficient' | 'demo';

function scoreTone(score: number | null): 'success' | 'warning' | 'neutral' | 'danger' {
  if (score === null) return 'neutral';
  if (score >= 75) return 'success';
  if (score >= 55) return 'warning';
  return 'danger';
}

function ScoreRing({ score, size = 58 }: { score: number | null; size?: number }) {
  const value = score ?? 0;
  const stroke = size < 70 ? 5 : 7;
  const radius = 50 - stroke / 2 - 2;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--surface-muted)" strokeWidth={stroke} />
        {score !== null && (
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={score >= 75 ? 'var(--success)' : score >= 55 ? 'var(--warning)' : 'var(--danger)'}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * 2 * Math.PI * radius} ${2 * Math.PI * radius}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display text-[13px] font-bold text-[var(--text)]">{score === null ? '—' : Math.round(score)}</span>
      </div>
    </div>
  );
}

function ReportRow({ report, demo }: { report: SessionReport; demo: boolean }) {
  const navigate = useNavigate();
  const topStrength = report.strengths[0];
  const topImprovement = report.improvements[0];
  return (
    <GlassCard hover className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <ScoreRing score={report.overallScore} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => navigate(`/reports/${report.id}`)}
              className="truncate text-left font-display text-[15px] font-bold text-[var(--text)] hover:text-[var(--accent-strong)]"
            >
              {report.lessonTitle}
            </button>
            {demo && <Badge tone="demo">DEMO</Badge>}
            <Badge tone={report.overallScore === null ? 'neutral' : scoreTone(report.overallScore)}>
              {report.overallScore === null ? 'Chưa đủ dữ liệu chấm điểm' : `${report.overallScore}/100`}
            </Badge>
            {report.aiSummary && <Badge tone="lavender">Có tóm tắt Gemini</Badge>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-[var(--muted)]">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> {formatDate(report.createdAt, true)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" /> {formatClock(report.metrics.durationSec)}
            </span>
            <span>{report.metrics.questionCount} câu hỏi</span>
            <span>{report.metrics.studentTurns} lượt học sinh</span>
            <span>Độ tin cậy {Math.round(report.overallConfidence * 100)}%</span>
          </p>
          <div className="mt-2 grid gap-1.5 text-[11px] md:grid-cols-2">
            <p className="flex min-w-0 items-start gap-1.5 rounded-lg bg-[var(--success-soft)] px-2 py-1 text-[var(--text-2)]">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--success)]" />
              <span className="line-clamp-2">{topStrength ? topStrength.title : 'Chưa có điểm mạnh đủ dữ liệu.'}</span>
            </p>
            <p className="flex min-w-0 items-start gap-1.5 rounded-lg bg-[var(--warning-soft)] px-2 py-1 text-[var(--text-2)]">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--warning)]" />
              <span className="line-clamp-2">{topImprovement ? topImprovement.title : 'Chưa có điểm cần cải thiện cụ thể.'}</span>
            </p>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 md:flex-col md:items-end">
        <Button size="sm" variant="secondary" iconRight={<ArrowRight className="h-3.5 w-3.5" />} onClick={() => navigate(`/reports/${report.id}`)}>
          Xem báo cáo
        </Button>
        <span className="text-[9.5px] text-[var(--muted)]">
          {report.generatedBy === 'gemini' ? 'Tổng hợp có Gemini' : 'Tổng hợp bằng quy tắc'}
        </span>
      </div>
    </GlassCard>
  );
}

export function ReportsPage() {
  usePageTitle('Báo cáo luyện tập');
  const navigate = useNavigate();
  const reports = useLiveQuery(() => reportRepo.list(), []);
  const sessions = useLiveQuery(() => sessionRepo.list(), []);
  const lessons = useLiveQuery(() => lessonRepo.list(), []);
  const trainingResults = useLiveQuery(() => trainingRepo.list(), []);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<ReportFilter>('all');
  const [subject, setSubject] = useState('all');

  const allReports = reports ?? [];
  const allSessions = sessions ?? [];
  const loading = reports === undefined || sessions === undefined || lessons === undefined || trainingResults === undefined;

  const sessionById = useMemo(() => {
    const map = new Map<string, (typeof allSessions)[number]>();
    for (const session of allSessions) map.set(session.id, session);
    return map;
  }, [allSessions]);

  const realReports = useMemo(() => allReports.filter((report) => !report.isDemo), [allReports]);
  const demoReports = useMemo(() => allReports.filter((report) => report.isDemo), [allReports]);
  const scoredReports = useMemo(() => realReports.filter((report) => report.overallScore !== null), [realReports]);
  const averageScore = average(scoredReports.map((report) => report.overallScore as number));
  const improved = useMemo(
    () => realReports.reduce((sum, report) => sum + report.improvements.length, 0),
    [realReports],
  );
  const trainingPassed = (trainingResults ?? []).filter((result) => result.passed === true && !result.isDemo).length;
  const interrupted = allSessions.filter((session) => session.status === 'active' || session.status === 'paused');
  const missingReports = allSessions.filter(
    (session) => session.status === 'completed' && !allReports.some((report) => report.sessionId === session.id),
  );

  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const lesson of lessons ?? []) map.set(lesson.id, lesson.subject);
    return Array.from(new Set(Array.from(map.values()))).sort();
  }, [lessons]);

  const filtered = useMemo(() => {
    const needle = normalizeSearch(deferredQuery);
    return allReports.filter((report) => {
      if (filter === 'demo' && !report.isDemo) return false;
      if (filter !== 'demo' && report.isDemo) return false;
      if (filter === 'scored' && report.overallScore === null) return false;
      if (filter === 'insufficient' && report.overallScore !== null) return false;
      if (subject !== 'all') {
        const lesson = (lessons ?? []).find((item) => item.id === report.lessonPlanId);
        if (!lesson || lesson.subject !== subject) return false;
      }
      if (!needle) return true;
      return normalizeSearch(
        `${report.lessonTitle} ${report.strengths.map((item) => item.title).join(' ')} ${report.improvements
          .map((item) => item.title)
          .join(' ')}`,
      ).includes(needle);
    });
  }, [allReports, deferredQuery, filter, lessons, subject]);

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Báo cáo luyện tập" description="Đang tổng hợp báo cáo trên thiết bị…" />
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="Báo cáo luyện tập"
        eyebrow="Bằng chứng từ dữ liệu thật"
        description="Mọi chỉ số đều lấy từ micro, camera, lời giảng và sự kiện lớp học đã ghi. Chỉ số thiếu dữ liệu được ghi rõ thay vì tạo điểm giả."
        icon={<BarChart3 className="h-6 w-6" />}
        actions={
          <Button variant="primary" icon={<MonitorPlay className="h-4 w-4" />} onClick={() => navigate('/practice')}>
            Luyện tập mới
          </Button>
        }
      />

      {(interrupted.length > 0 || missingReports.length > 0) && (
        <GlassCard className="border-[var(--warning)]/30">
          <SectionHeader
            title="Cần khôi phục"
            description="Buổi luyện bị gián đoạn hoặc thiếu báo cáo. Dữ liệu vẫn nằm trên thiết bị."
            icon={<AlertTriangle className="h-5 w-5" />}
            action={<Badge tone="warning">{interrupted.length + missingReports.length}</Badge>}
          />
          <div className="mt-3 space-y-2">
            {interrupted.map((session) => (
              <div key={session.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--warning-soft)] px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-[var(--text)]">{session.lessonTitle}</p>
                  <p className="text-[10.5px] text-[var(--text-2)]">
                    {session.status === 'paused' ? 'Tạm dừng' : 'Bị gián đoạn'} · {formatRelative(session.startedAt)} · đã lưu{' '}
                    {formatClock(session.durationSec)}
                  </p>
                </div>
                <Button size="sm" variant="secondary" iconRight={<ArrowRight className="h-3.5 w-3.5" />} onClick={() => navigate(`/practice/${session.id}/live`)}>
                  Khôi phục
                </Button>
              </div>
            ))}
            {missingReports.map((session) => (
              <div key={session.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-[var(--text)]">{session.lessonTitle}</p>
                  <p className="text-[10.5px] text-[var(--text-2)]">
                    Đã kết thúc {formatRelative(session.endedAt ?? session.startedAt)} nhưng chưa có báo cáo.
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => navigate(`/practice/${session.id}/live`)}>
                  Tạo lại báo cáo
                </Button>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Báo cáo thật"
          value={`${realReports.length}`}
          hint={`${demoReports.length} báo cáo DEMO tách riêng`}
          icon={<BarChart3 className="h-5 w-5" />}
          tone="accent"
        />
        <StatCard
          label="Điểm trung bình"
          value={averageScore === null ? '—' : `${Math.round(averageScore)}/100`}
          hint={`${scoredReports.length} báo cáo đủ dữ liệu chấm`}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="green"
        />
        <StatCard
          label="Điểm cần cải thiện"
          value={`${improved}`}
          hint="Tổng hợp từ mục cải thiện của báo cáo thật"
          icon={<Sparkles className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Bài luyện đạt"
          value={`${trainingPassed}`}
          hint={`${(trainingResults ?? []).length} kết quả đã lưu`}
          icon={<Dumbbell className="h-5 w-5" />}
          tone="violet"
          onClick={() => navigate('/training')}
        />
      </div>

      <GlassCard>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <Input
            label="Tìm kiếm báo cáo"
            placeholder="Tên bài, điểm mạnh, điểm cần cải thiện…"
            leading={<Search className="h-4 w-4" />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select
              label="Loại báo cáo"
              value={filter}
              onChange={(event) => setFilter(event.target.value as ReportFilter)}
              options={[
                { value: 'all', label: 'Tất cả (không DEMO)' },
                { value: 'scored', label: 'Có điểm tổng' },
                { value: 'insufficient', label: 'Chưa đủ dữ liệu' },
                { value: 'demo', label: 'DEMO' },
              ]}
              className="min-w-[170px]"
            />
            <Select
              label="Môn học"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              options={[{ value: 'all', label: 'Tất cả môn' }, ...subjectOptions.map((item) => ({ value: item, label: item }))]}
              className="min-w-[140px]"
            />
          </div>
        </div>
        <p className="mt-2 text-[10.5px] text-[var(--muted)]">
          {allSessions.filter((session) => session.isDemo).length > 0
            ? 'Các buổi luyện dùng bài DEMO được gắn nhãn DEMO và không tính vào thống kê thật.'
            : 'Báo cáo DEMO được tách khỏi thống kê thật.'}
        </p>
      </GlassCard>

      {filtered.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={<BarChart3 className="h-6 w-6" />}
            title={allReports.length === 0 ? 'Chưa có báo cáo nào' : 'Không có báo cáo phù hợp'}
            description={
              allReports.length === 0
                ? 'Hoàn thành một buổi luyện để hệ thống tạo báo cáo từ dữ liệu thật đã ghi. Không có báo cáo mẫu hay điểm giả.'
                : 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.'
            }
            action={
              allReports.length === 0 ? (
                <Button icon={<PlayCircle className="h-4 w-4" />} onClick={() => navigate('/practice')}>
                  Bắt đầu buổi luyện
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('');
                    setFilter('all');
                    setSubject('all');
                  }}
                >
                  Xóa bộ lọc
                </Button>
              )
            }
          />
        </GlassCard>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((report) => (
            <ReportRow
              key={report.id}
              report={report}
              demo={Boolean(report.isDemo || sessionById.get(report.sessionId)?.isDemo)}
            />
          ))}
        </div>
      )}

      {realReports.length > 0 && (
        <GlassCard>
          <SectionHeader
            title="Cách đọc báo cáo"
            description="Các chỉ số dưới đây chỉ có nghĩa khi buổi luyện thực sự thu được dữ liệu tương ứng."
            icon={<FileWarning className="h-5 w-5" />}
          />
          <div className="mt-3 grid gap-2 text-[11.5px] leading-relaxed text-[var(--text-2)] md:grid-cols-3">
            <div className="rounded-xl bg-[var(--surface-muted)] p-3">
              <p className="font-semibold text-[var(--text)]">Điểm tổng</p>
              <p className="mt-0.5">
                Chỉ xuất hiện khi có ít nhất hai nhóm năng lực đủ dữ liệu và độ tin cậy đạt ngưỡng. Nếu không, báo cáo ghi
                “chưa đủ dữ liệu”.
              </p>
            </div>
            <div className="rounded-xl bg-[var(--surface-muted)] p-3">
              <p className="font-semibold text-[var(--text)]">Tư thế</p>
              <p className="mt-0.5">
                Cần camera bật trong buổi luyện. MediaPipe chạy cục bộ, không nhận diện danh tính hay cảm xúc.
              </p>
            </div>
            <div className="rounded-xl bg-[var(--surface-muted)] p-3">
              <p className="font-semibold text-[var(--text)]">Giọng nói</p>
              <p className="mt-0.5">
                Cần micro hoặc lời giảng nhập tay. Học sinh AI trả lời bằng văn bản nên thời gian nói của học sinh luôn là
                0 giây và được ghi chú rõ.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {realReports.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard>
            <SectionHeader title="Năng lực nổi bật gần đây" description="Lấy từ báo cáo thật mới nhất." icon={<CheckCircle2 className="h-5 w-5" />} />
            <div className="mt-3 space-y-2">
              {(realReports[0]?.competencies ?? []).map((competency) => (
                <div key={competency.category}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[11.5px] font-semibold text-[var(--text)]">{CATEGORY_SHORT[competency.category]}</span>
                    <span className="text-[10px] text-[var(--muted)]">
                      {competency.insufficientData || competency.score === null
                        ? 'chưa đủ dữ liệu'
                        : `${Math.round(competency.score)}/100`}
                    </span>
                  </div>
                  <Progress
                    value={competency.score ?? 0}
                    tone={
                      competency.score === null
                        ? 'accent'
                        : competency.score >= 75
                          ? 'success'
                          : competency.score >= 55
                            ? 'warning'
                            : 'danger'
                    }
                    size="sm"
                  />
                </div>
              ))}
            </div>
            {realReports[0] && (
              <Link
                to={`/reports/${realReports[0].id}`}
                className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--accent-strong)] hover:underline"
              >
                Mở báo cáo gần nhất <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </GlassCard>

          <GlassCard>
            <SectionHeader title="Buổi luyện gần đây" description="Kể cả buổi chưa có báo cáo." icon={<Clock3 className="h-5 w-5" />} />
            <div className="mt-3 space-y-1.5">
              {allSessions.slice(0, 6).map((session) => {
                const report = allReports.find((item) => item.sessionId === session.id);
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => navigate(report ? `/reports/${report.id}` : `/practice/${session.id}/live`)}
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-[var(--accent-softer)]"
                  >
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', session.isDemo ? 'bg-[var(--warning)]' : 'bg-[var(--accent)]')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-semibold text-[var(--text)]">
                        {session.lessonTitle} {session.isDemo ? '· DEMO' : ''}
                      </span>
                      <span className="block text-[10px] text-[var(--muted)]">
                        {formatRelative(session.startedAt)} · {formatClock(session.durationSec)} · {MODE_LABELS[session.mode]}
                      </span>
                    </span>
                    <Badge tone={report ? 'success' : session.status === 'completed' ? 'warning' : 'neutral'}>
                      {report ? 'Có báo cáo' : session.status === 'completed' ? 'Thiếu báo cáo' : 'Chưa xong'}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </GlassCard>
        </div>
      )}

      <InfoNote>
        Báo cáo không đánh giá ngoại hình, danh tính hay cảm xúc. Các nhận xét về tư thế chỉ mô tả vị trí và chuyển động
        trong khung hình. Bạn có thể xóa từng buổi luyện và báo cáo trong trang chi tiết.
      </InfoNote>
    </div>
  );
}
