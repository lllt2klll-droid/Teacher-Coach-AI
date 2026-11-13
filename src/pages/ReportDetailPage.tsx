import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Dumbbell,
  Eye,
  FileAudio,
  FileText,
  Info,
  Lightbulb,
  MessageSquare,
  Mic,
  PlayCircle,
  Printer,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  UsersRound,
  Video,
} from 'lucide-react';
import {
  Badge,
  EmptyState,
  GlassCard,
  LoadingState,
  PageHeader,
  Progress,
  SectionHeader,
} from '@/components/ui/Display';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog, InfoNote } from '@/components/ui/Overlay';
import { Tabs } from '@/components/ui/Tabs';
import { usePageTitle } from '@/hooks/usePageTitle';
import { recordingRepo, reportRepo, sessionRepo, trainingRepo, transcriptRepo } from '@/data/repositories';
import {
  CATEGORY_LABELS,
  MODE_LABELS,
  SEVERITY_LABELS,
  formatBytes,
  formatClock,
  formatDate,
  formatTimestamp,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from '@/store/toast-store';
import { openReportPrintWindow } from '@/services/report/export-report';
import type {
  CompetencyScore,
  EvidenceSource,
  SessionReport,
  TranscriptSegment,
  TrainingResult,
} from '@/types/domain';

const SOURCE_LABELS: Record<EvidenceSource, string> = {
  transcript: 'Lời giảng',
  audio: 'Micro',
  pose: 'Camera / tư thế',
  classroom: 'Sự kiện lớp học',
  lesson: 'Kế hoạch bài dạy',
};

function scoreTone(score: number | null): 'success' | 'warning' | 'danger' | 'accent' {
  if (score === null) return 'accent';
  if (score >= 75) return 'success';
  if (score >= 55) return 'warning';
  return 'danger';
}

function ScoreCircle({ score, size = 132 }: { score: number | null; size?: number }) {
  const value = score ?? 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--surface-muted)" strokeWidth="8" />
        {score !== null && (
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={score >= 75 ? 'var(--success)' : score >= 55 ? 'var(--warning)' : 'var(--danger)'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-[27px] font-bold leading-none text-[var(--text)]">{score === null ? '—' : Math.round(score)}</p>
          <p className="mt-1 text-[9.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {score === null ? 'chưa đủ dữ liệu' : 'trên 100'}
          </p>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 font-display text-[17px] font-bold leading-tight text-[var(--text)]">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

function CompetencyRow({ competency }: { competency: CompetencyScore }) {
  return (
    <div className="rounded-xl border border-[var(--border-soft)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold text-[var(--text)]">{competency.label}</p>
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--muted)]">{competency.notes}</p>
        </div>
        <Badge tone={competency.insufficientData || competency.score === null ? 'neutral' : scoreTone(competency.score)}>
          {competency.insufficientData || competency.score === null ? 'Chưa đủ dữ liệu' : `${Math.round(competency.score)}/100`}
        </Badge>
      </div>
      <div className="mt-2">
        <Progress
          value={competency.score ?? 0}
          tone={competency.insufficientData ? 'accent' : scoreTone(competency.score)}
          size="sm"
        />
        <div className="mt-1 flex flex-wrap justify-between gap-2 text-[9.5px] text-[var(--muted)]">
          <span>Độ tin cậy {Math.round(competency.confidence * 100)}%</span>
          <span>{competency.sampleSize} mẫu dữ liệu</span>
        </div>
      </div>
    </div>
  );
}

function InsightList({
  report,
  kind,
}: {
  report: SessionReport;
  kind: 'strengths' | 'improvements';
}) {
  const list = report[kind];
  const evidenceById = useMemo(() => new Map(report.evidence.map((item) => [item.id, item])), [report.evidence]);
  if (list.length === 0) {
    return (
      <p className="rounded-xl bg-[var(--surface-muted)] px-3 py-4 text-[11.5px] leading-relaxed text-[var(--text-2)]">
        {kind === 'strengths'
          ? 'Chưa ghi nhận điểm mạnh đủ bằng chứng. Hãy luyện thêm với micro/camera để có dữ liệu.'
          : 'Chưa ghi nhận điểm cần cải thiện cụ thể từ dữ liệu của buổi này.'}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {list.map((insight, index) => (
        <div key={`${insight.title}-${index}`} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-solid)] p-3">
          <div className="flex items-start gap-2">
            <span
              className={cn(
                'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg',
                kind === 'strengths'
                  ? 'bg-[var(--success-soft)] text-[var(--success)]'
                  : 'bg-[var(--warning-soft)] text-[var(--warning)]',
              )}
            >
              {kind === 'strengths' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Lightbulb className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-[var(--text)]">{insight.title}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--text-2)]">{insight.detail}</p>
              {insight.evidenceIds.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {insight.evidenceIds
                    .map((id) => evidenceById.get(id))
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((evidence) => (
                      <p
                        key={evidence!.id}
                        className="rounded-lg bg-[var(--surface-muted)] px-2 py-1.5 text-[10px] leading-relaxed text-[var(--text-2)]"
                      >
                        <span className="font-semibold text-[var(--text)]">
                          [{formatTimestamp(evidence!.timestamp)} · {SOURCE_LABELS[evidence!.source]}]
                        </span>{' '}
                        {evidence!.observedFact}
                      </p>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TrainingResultCard({ result }: { result: TrainingResult }) {
  return (
    <GlassCard>
      <SectionHeader
        title={result.exerciseTitle}
        description="Kết quả được tính từ tiêu chí và dữ liệu thật của buổi luyện."
        icon={<Dumbbell className="h-5 w-5" />}
        action={
          <Badge tone={result.passed === true ? 'success' : result.passed === false ? 'danger' : 'neutral'}>
            {result.passed === true ? 'Đạt' : result.passed === false ? 'Chưa đạt' : 'Chưa đủ dữ liệu'}
          </Badge>
        }
      />
      <p className="mt-2 text-[11.5px] text-[var(--text-2)]">
        Điểm tiêu chí: {result.score === null ? '—' : `${result.score}/100`} · Thời lượng {formatClock(result.durationSec)}
      </p>
      <div className="mt-3 space-y-1.5">
        {result.criteriaResults.map((criterion) => (
          <div
            key={criterion.criterionId}
            className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-[11.5px] font-semibold text-[var(--text)]">{criterion.label}</p>
              <p className="text-[10px] text-[var(--muted)]">
                Quan sát: {criterion.observed === null ? 'chưa đủ dữ liệu' : criterion.observed} · Mục tiêu: {criterion.target}
              </p>
            </div>
            <Badge tone={criterion.met === true ? 'success' : criterion.met === false ? 'danger' : 'neutral'}>
              {criterion.met === true ? 'Đạt' : criterion.met === false ? 'Chưa đạt' : '—'}
            </Badge>
          </div>
        ))}
      </div>
      <Link
        to="/training"
        className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--accent-strong)] hover:underline"
      >
        Mở trung tâm luyện tập <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </GlassCard>
  );
}

export function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  usePageTitle('Chi tiết báo cáo');
  const report = useLiveQuery(() => (reportId ? reportRepo.get(reportId) : Promise.resolve(undefined)), [reportId]);
  const session = useLiveQuery(
    () => (report ? sessionRepo.get(report.sessionId) : Promise.resolve(undefined)),
    [report?.sessionId],
  );
  const transcripts = useLiveQuery(
    () => (report ? transcriptRepo.forSession(report.sessionId) : Promise.resolve([])),
    [report?.sessionId],
  );
  const trainingResults = useLiveQuery(() => trainingRepo.list(), []);
  const [tab, setTab] = useState('overview');
  const [transcriptFilter, setTranscriptFilter] = useState<'all' | 'teacher'>('all');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingMeta, setRecordingMeta] = useState<{ mimeType: string; size: number } | null>(null);
  const [removeRecordingOpen, setRemoveRecordingOpen] = useState(false);
  const [nowText, setNowText] = useState('');

  useEffect(() => {
    if (!report) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void recordingRepo
      .get(report.sessionId)
      .then((record) => {
        if (cancelled || !record) return;
        objectUrl = URL.createObjectURL(record.blob);
        setRecordingUrl(objectUrl);
        setRecordingMeta({ mimeType: record.mimeType, size: record.blob.size });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [report?.sessionId]);

  useEffect(() => {
    if (!recordingMeta) return;
    setNowText(new Date().toLocaleTimeString('vi-VN'));
  }, [recordingMeta]);

  const trainingResult = useMemo(
    () => (trainingResults ?? []).find((result) => result.sessionId === report?.sessionId),
    [report?.sessionId, trainingResults],
  );

  const filteredTranscript = useMemo(() => {
    const list = transcripts ?? [];
    return transcriptFilter === 'teacher' ? list.filter((segment) => segment.speaker === 'teacher') : list;
  }, [transcriptFilter, transcripts]);

  const handleDelete = async () => {
    if (!report) return;
    setDeleting(true);
    try {
      if (session) {
        await sessionRepo.remove(session.id);
      } else {
        await reportRepo.remove(report.id);
      }
      toast.success('Đã xóa báo cáo và dữ liệu buổi luyện');
      navigate('/reports', { replace: true });
    } catch (error) {
      console.error(error);
      toast.error('Không xóa được báo cáo');
    } finally {
      setDeleting(false);
    }
  };

  const handleRemoveRecording = async () => {
    if (!report) return;
    try {
      await recordingRepo.remove(report.sessionId);
      setRecordingUrl(null);
      setRecordingMeta(null);
      setRemoveRecordingOpen(false);
      toast.success('Đã xóa bản ghi âm/hình khỏi thiết bị');
    } catch (error) {
      console.error(error);
      toast.error('Không xóa được bản ghi');
    }
  };

  const handleExportPdf = () => {
    if (!report) return;
    const opened = openReportPrintWindow(report, trainingResult);
    if (!opened) {
      toast.error(
        'Trình duyệt đã chặn cửa sổ in',
        'Cho phép cửa sổ bật lên cho trang này rồi thử lại. Bạn vẫn có thể dùng Ctrl+P.',
      );
    }
  };

  if (!reportId) {
    return (
      <GlassCard>
        <EmptyState icon={<FileText className="h-6 w-6" />} title="Thiếu mã báo cáo" action={<Button onClick={() => navigate('/reports')}>Về báo cáo</Button>} />
      </GlassCard>
    );
  }

  if (report === undefined) {
    return (
      <div className="space-y-5">
        <PageHeader title="Chi tiết báo cáo" description="Đang tải báo cáo…" />
        <LoadingState />
      </div>
    );
  }

  if (!report) {
    return (
      <GlassCard>
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Không tìm thấy báo cáo"
          description="Báo cáo có thể đã bị xóa khỏi thiết bị này."
          action={<Button icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/reports')}>Về danh sách báo cáo</Button>}
        />
      </GlassCard>
    );
  }

  const m = report.metrics;
  const demo = Boolean(report.isDemo || session?.isDemo);
  const coveragePercent = m.phaseCount > 0 ? Math.round((m.coveredPhaseCount / m.phaseCount) * 100) : null;
  const metrics: Array<{ label: string; value: string; hint?: string }> = [
    {
      label: 'Thời lượng',
      value: formatClock(m.durationSec),
      hint: session ? `Bắt đầu ${formatDate(session.startedAt, true)}` : undefined,
    },
    {
      label: 'Tỉ lệ giáo viên nói',
      value: m.teacherSpeakingSec > 0 ? `${Math.round(m.speechRatio * 100)}%` : '—',
      hint: 'Thời gian micro ghi nhận tiếng nói / thời lượng buổi',
    },
    { label: 'Tốc độ nói', value: m.wordsPerMinute === null ? '—' : `${m.wordsPerMinute} từ/phút`, hint: 'Cần đủ lời giảng để tính' },
    {
      label: 'Độ biến thiên âm lượng',
      value: m.volumeVariabilityDb === null ? '—' : `${m.volumeVariabilityDb.toFixed(1)} dB`,
      hint: 'Độ lệch chuẩn âm lượng khi nói',
    },
    {
      label: 'Khoảng lặng',
      value: m.avgVolumeDb === null && m.pauseCount === 0 ? '—' : `${m.pauseCount} lần`,
      hint: m.longestPauseSec > 0 ? `Dài nhất ${m.longestPauseSec.toFixed(1)} giây` : 'Từ 2 giây trở lên',
    },
    { label: 'Câu hỏi', value: `${m.questionCount}`, hint: `${m.openQuestionCount} mở · ${m.closedQuestionCount} đóng` },
    { label: 'Khen / khích lệ', value: `${m.praiseCount} / ${m.encouragementCount}`, hint: 'Đếm từ lời giảng thật' },
    { label: 'Chuyển hoạt động', value: `${m.transitionCount}`, hint: 'Tín hiệu chuyển bước trong lời giảng' },
    {
      label: 'Tư thế quan sát',
      value: m.postureVisibility === null ? '—' : `${Math.round(m.postureVisibility * 100)}%`,
      hint: m.postureSamples > 0 ? `${m.postureSamples} mẫu từ camera` : 'Chưa bật camera',
    },
    {
      label: 'Độ ổn định tư thế',
      value: m.postureStability === null ? '—' : `${Math.round(m.postureStability * 100)}%`,
      hint: 'Chỉ mô tả chuyển động trong khung hình',
    },
    {
      label: 'Tương tác học sinh',
      value: `${m.handRaiseCount} giơ tay · ${m.answerCount} trả lời`,
      hint: `${m.wrongAnswerCount} câu trả lời sai/chưa đủ`,
    },
    {
      label: 'Độ phủ hoạt động',
      value: coveragePercent === null ? '—' : `${coveragePercent}%`,
      hint: `${m.coveredPhaseCount}/${m.phaseCount} hoạt động có bằng chứng`,
    },
  ];

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title={report.lessonTitle}
        eyebrow="Báo cáo dựa trên bằng chứng"
        description={`${formatDate(report.createdAt, true)} · ${report.generatedBy === 'gemini' ? 'Tổng hợp có hỗ trợ Gemini' : 'Tổng hợp bằng quy tắc cục bộ'} · Độ tin cậy ${Math.round(report.overallConfidence * 100)}%`}
        icon={<BarChart3 className="h-6 w-6" />}
        actions={
          <>
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/reports')}>
              Danh sách
            </Button>
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={handleExportPdf}>
              In / Xuất PDF
            </Button>
            <Button variant="secondary" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)}>
              Xóa báo cáo
            </Button>
            <Button icon={<PlayCircle className="h-4 w-4" />} onClick={() => navigate('/practice')}>
              Luyện lại
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {demo && <Badge tone="demo">DEMO · không tính vào thống kê thật</Badge>}
        <Badge tone={report.aiSummary ? 'lavender' : 'neutral'}>
          {report.aiSummary ? 'Có tóm tắt Gemini' : 'Không dùng AI tóm tắt'}
        </Badge>
        {session && <Badge tone="outline">{MODE_LABELS[session.mode]}</Badge>}
        {session?.className && <Badge tone="outline">{session.className}</Badge>}
        {report.isDemo && <Badge tone="warning">Dữ liệu bài DEMO</Badge>}
      </div>

      {!report.isDemo && (
        <InfoNote>
          Điểm số và nhận xét chỉ hình thành từ dữ liệu thật của buổi luyện. Chỉ số nào không đủ mẫu sẽ hiển thị “chưa đủ dữ
          liệu”, không được quy đổi thành điểm trung bình.
        </InfoNote>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1.9fr]">
        <GlassCard tone="accent" className="flex flex-col items-center justify-center gap-3 text-center">
          <ScoreCircle score={report.overallScore} />
          <div>
            <p className="font-display text-[15px] font-bold text-[var(--text)]">
              {report.overallScore === null ? 'Chưa đủ dữ liệu để chấm điểm tổng' : 'Điểm tổng có bằng chứng'}
            </p>
            <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-[var(--text-2)]">
              {report.overallScore === null
                ? 'Cần ít nhất hai nhóm năng lực đủ dữ liệu và độ tin cậy đạt ngưỡng. Hãy luyện lại với micro hoặc camera.'
                : 'Điểm tổng là trung bình có trọng số của các nhóm năng lực đủ dữ liệu, không phải điểm tuyệt đối.'}
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2">
            <div className="rounded-xl bg-[var(--surface-muted)] px-2 py-2">
              <p className="font-display text-[15px] font-bold text-[var(--text)]">{report.competencies.filter((item) => !item.insufficientData).length}</p>
              <p className="text-[9.5px] text-[var(--muted)]">nhóm đủ dữ liệu</p>
            </div>
            <div className="rounded-xl bg-[var(--surface-muted)] px-2 py-2">
              <p className="font-display text-[15px] font-bold text-[var(--text)]">{report.evidence.length}</p>
              <p className="text-[9.5px] text-[var(--muted)]">bằng chứng ghi nhận</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <SectionHeader
            title="Tóm tắt buổi luyện"
            description="Thông tin khái quát từ dữ liệu thật của buổi."
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <Metric label="Thời lượng" value={formatClock(m.durationSec)} />
            <Metric label="Lượt học sinh" value={`${m.studentTurns}`} hint="Từ lớp mô phỏng" />
            <Metric label="Câu hỏi" value={`${m.questionCount}`} hint={`${m.openQuestionCount} câu hỏi mở`} />
            <Metric label="Giơ tay" value={`${m.handRaiseCount}`} hint="Sự kiện lớp học" />
            <Metric label="Điểm mạnh" value={`${report.strengths.length}`} />
            <Metric label="Cần cải thiện" value={`${report.improvements.length}`} />
          </div>
          {report.aiSummary && (
            <div className="mt-3 rounded-xl border border-[var(--lavender)]/25 bg-[var(--lavender-soft)] p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--lavender)]">
                <Sparkles className="h-3.5 w-3.5" /> Tóm tắt do Gemini tạo qua server proxy
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--text-2)]">{report.aiSummary.summary}</p>
              <p className="mt-1.5 text-[9.5px] text-[var(--muted)]">
                Phần tóm tắt ngôn ngữ không thay đổi điểm số hay bằng chứng trong báo cáo.
              </p>
            </div>
          )}
          {report.recommendations.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-bold text-[var(--text)]">Gợi ý tiếp theo</p>
              <ul className="mt-1 space-y-1 text-[11.5px] leading-relaxed text-[var(--text-2)]">
                {report.recommendations.map((item, index) => (
                  <li key={index} className="flex items-start gap-1.5">
                    <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </GlassCard>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Năng lực & chỉ số', icon: <BarChart3 className="h-3.5 w-3.5" /> },
          { id: 'evidence', label: `Bằng chứng (${report.evidence.length})`, icon: <Eye className="h-3.5 w-3.5" /> },
          { id: 'transcript', label: `Lời giảng (${(transcripts ?? []).length})`, icon: <MessageSquare className="h-3.5 w-3.5" /> },
          { id: 'training', label: 'Bài luyện & ghi âm', icon: <Dumbbell className="h-3.5 w-3.5" /> },
        ]}
      />

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {metrics.map((metric) => (
              <Metric key={metric.label} {...metric} />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <SectionHeader title="Điểm mạnh" description="Kèm bằng chứng cụ thể." icon={<Award className="h-5 w-5" />} />
              <div className="mt-3">
                <InsightList report={report} kind="strengths" />
              </div>
            </GlassCard>
            <GlassCard>
              <SectionHeader title="Cần cải thiện" description="Kèm bằng chứng cụ thể." icon={<Lightbulb className="h-5 w-5" />} />
              <div className="mt-3">
                <InsightList report={report} kind="improvements" />
              </div>
            </GlassCard>
          </div>

          <GlassCard>
            <SectionHeader title="Điểm năng lực" description="Chỉ hiển thị điểm khi có đủ mẫu dữ liệu." icon={<Target className="h-5 w-5" />} />
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {report.competencies.map((competency) => (
                <CompetencyRow key={competency.category} competency={competency} />
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeader
              title="Độ phủ hoạt động"
              description="Hoạt động được xem là có bằng chứng khi có lời giảng hoặc sự kiện lớp học tương ứng."
              icon={<UsersRound className="h-5 w-5" />}
            />
            <div className="mt-3 space-y-2">
              {report.phaseProgress.map((phase) => (
                <div key={phase.phaseId} className="rounded-xl border border-[var(--border-soft)] px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold text-[var(--text)]">{phase.name}</p>
                    <Badge tone={phase.covered ? 'success' : 'neutral'}>
                      {phase.covered ? 'Có bằng chứng' : 'Chưa có bằng chứng'}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-[var(--muted)]">
                    <span>{phase.evidenceTimestamps.length} mốc thời gian</span>
                    <span>Độ tin cậy {Math.round(phase.coverageConfidence * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <InfoNote tone="warning">
            <strong>Giới hạn dữ liệu:</strong> học sinh AI trả lời bằng văn bản nên báo cáo không có thời gian nói thật của học
            sinh. Chỉ số “thời gian nói của học sinh” luôn là 0 giây, không phải số liệu giả. Các nhận xét tư thế chỉ dựa
            trên khung xương MediaPipe, không nhận diện danh tính hay cảm xúc.
          </InfoNote>
        </div>
      )}

      {tab === 'evidence' && (
        <GlassCard>
          <SectionHeader
            title="Danh sách bằng chứng"
            description="Mỗi mục là một quan sát cụ thể từ lời giảng, micro, camera hoặc lớp học mô phỏng."
            icon={<Eye className="h-5 w-5" />}
            action={<Badge tone="outline">{report.evidence.length} mục</Badge>}
          />
          {report.evidence.length === 0 ? (
            <EmptyState
              compact
              icon={<Eye className="h-5 w-5" />}
              title="Chưa có bằng chứng"
              description="Buổi luyện chưa thu được lời giảng, sự kiện hoặc dữ liệu thiết bị."
            />
          ) : (
            <div className="mt-3 space-y-1.5">
              {report.evidence.map((evidence) => (
                <div key={evidence.id} className="rounded-xl border border-[var(--border-soft)] px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral">{formatTimestamp(evidence.timestamp)}</Badge>
                    <Badge tone={evidence.source === 'pose' ? 'lavender' : evidence.source === 'audio' ? 'accent' : 'outline'}>
                      {SOURCE_LABELS[evidence.source]}
                    </Badge>
                    <span className="text-[9.5px] text-[var(--muted)]">Độ tin cậy {Math.round(evidence.confidence * 100)}%</span>
                  </div>
                  <p className="mt-1 text-[11.5px] font-semibold leading-relaxed text-[var(--text)]">{evidence.observedFact}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-2)]">{evidence.interpretation}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {tab === 'transcript' && (
        <GlassCard>
          <SectionHeader
            title="Lời giảng & hội thoại"
            description="Chỉ gồm những gì đã được nhận dạng hoặc nhập trong buổi luyện."
            icon={<MessageSquare className="h-5 w-5" />}
            action={
              <div className="flex gap-1.5">
                <Button size="sm" variant={transcriptFilter === 'all' ? 'primary' : 'ghost'} onClick={() => setTranscriptFilter('all')}>
                  Tất cả
                </Button>
                <Button
                  size="sm"
                  variant={transcriptFilter === 'teacher' ? 'primary' : 'ghost'}
                  icon={<Mic className="h-3.5 w-3.5" />}
                  onClick={() => setTranscriptFilter('teacher')}
                >
                  Giáo viên
                </Button>
              </div>
            }
          />
          {filteredTranscript.length === 0 ? (
            <EmptyState
              compact
              icon={<MessageSquare className="h-5 w-5" />}
              title="Chưa có lời giảng"
              description="Buổi luyện không ghi nhận lời nói hoặc lời nhập thủ công."
            />
          ) : (
            <div className="thin-scrollbar mt-3 max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {filteredTranscript.map((segment: TranscriptSegment) => {
                const isTeacher = segment.speaker === 'teacher';
                return (
                  <div key={segment.id} className={cn('flex', isTeacher ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-3 py-2',
                        isTeacher ? 'bg-[var(--accent-soft)]' : 'border border-[var(--border-soft)] bg-[var(--surface-muted)]',
                      )}
                    >
                      <p className="mb-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[var(--muted)]">
                        {isTeacher ? 'Giáo viên' : 'Học sinh AI'} · {formatTimestamp(segment.startTime)}
                        {segment.source === 'speech' ? ' · nhận dạng giọng nói' : segment.source === 'ai' ? ' · AI hư cấu' : ' · nhập tay'}
                      </p>
                      <p className="text-[12px] leading-relaxed text-[var(--text)]">{segment.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      )}

      {tab === 'training' && (
        <div className="space-y-4">
          {trainingResult ? (
            <TrainingResultCard result={trainingResult} />
          ) : (
            <GlassCard>
              <SectionHeader title="Bài luyện có tiêu chí" description="Buổi này không gắn với bài luyện nào." icon={<Dumbbell className="h-5 w-5" />} />
              <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--text-2)]">
                Bạn có thể chọn một bài luyện trong Trung tâm luyện tập cho buổi tiếp theo. Kết quả sẽ được tính tự động từ
                chỉ số thật.
              </p>
              <Link to="/training" className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--accent-strong)] hover:underline">
                Mở trung tâm luyện tập <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </GlassCard>
          )}

          <GlassCard>
            <SectionHeader
              title="Bản ghi cục bộ"
              description="Chỉ có nếu bạn đã bật ghi hình/ghi âm trước khi luyện."
              icon={<Video className="h-5 w-5" />}
              action={
                recordingMeta && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setRemoveRecordingOpen(true)}
                  >
                    Xóa bản ghi
                  </Button>
                )
              }
            />
            {recordingUrl && recordingMeta ? (
              <div className="mt-3">
                {recordingMeta.mimeType.startsWith('video') ? (
                  <video controls src={recordingUrl} className="w-full rounded-xl bg-black" />
                ) : (
                  <div className="rounded-xl bg-[var(--surface-muted)] p-4">
                    <audio controls src={recordingUrl} className="w-full" />
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-[var(--muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <FileAudio className="h-3.5 w-3.5" /> {recordingMeta.mimeType || 'audio/video'} · {formatBytes(recordingMeta.size)}
                  </span>
                  <a
                    href={recordingUrl}
                    download={`teacher-coach-${report.sessionId}.webm`}
                    className="inline-flex items-center gap-1 font-semibold text-[var(--accent-strong)] hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" /> Tải bản ghi
                  </a>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">
                  Bản ghi nằm trong IndexedDB trên thiết bị này và không được tải lên máy chủ. Thời điểm mở trang: {nowText}.
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-[var(--border-soft)] px-3 py-6 text-center">
                <Video className="mx-auto h-7 w-7 text-[var(--muted)]" />
                <p className="mt-1.5 text-[11.5px] font-semibold text-[var(--text)]">Không có bản ghi</p>
                <p className="mx-auto mt-0.5 max-w-sm text-[10.5px] leading-relaxed text-[var(--muted)]">
                  Bản ghi chỉ được tạo khi bạn bật tùy chọn ghi hình/ghi âm trước buổi luyện. Báo cáo vẫn có dữ liệu đo từ
                  micro và camera.
                </p>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text)]">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--success)]" /> Quyền riêng tư
          </p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-[var(--text-2)]">
            Báo cáo không nhận diện danh tính, cảm xúc hay đánh giá ngoại hình người thật.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text)]">
            <Info className="h-3.5 w-3.5 text-[var(--info)]" /> Giới hạn suy luận
          </p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-[var(--text-2)]">
            Hệ thống chỉ suy luận từ số liệu đo và lời giảng. Không có dữ liệu nghĩa là không có điểm.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text)]">
            <CalendarDays className="h-3.5 w-3.5 text-[var(--accent-strong)]" /> Lưu cục bộ
          </p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-[var(--text-2)]">
            Báo cáo và bản ghi tồn tại trong trình duyệt này. Hãy sao lưu định kỳ trong Cài đặt.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
        loading={deleting}
        title="Xóa báo cáo và buổi luyện?"
        message="Toàn bộ báo cáo, lời giảng, dữ liệu đo và bản ghi liên quan sẽ bị xóa khỏi thiết bị. Không thể hoàn tác."
        confirmLabel="Xóa vĩnh viễn"
      />
      <ConfirmDialog
        open={removeRecordingOpen}
        onClose={() => setRemoveRecordingOpen(false)}
        onConfirm={() => void handleRemoveRecording()}
        title="Xóa bản ghi?"
        message="Bản ghi hình/âm sẽ bị xóa khỏi IndexedDB. Báo cáo và chỉ số vẫn được giữ."
        confirmLabel="Xóa bản ghi"
      />
    </div>
  );
}
