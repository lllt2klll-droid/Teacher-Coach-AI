import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Copy,
  FileText,
  GripVertical,
  Info,
  ListChecks,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  Badge,
  EmptyState,
  GlassCard,
  LoadingState,
  PageHeader,
  SectionHeader,
} from '@/components/ui/Display';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Inputs';
import { ConfirmDialog, InfoNote, Modal } from '@/components/ui/Overlay';
import { Tabs } from '@/components/ui/Tabs';
import { usePageTitle } from '@/hooks/usePageTitle';
import { lessonRepo } from '@/data/repositories';
import type { LessonObjective, LessonPhase, LessonPhaseType, LessonPlan } from '@/types/domain';
import {
  GRADE_OPTIONS,
  PHASE_TYPE_LABELS,
  PHASE_TYPE_SHORT,
  SUBJECT_OPTIONS,
  formatDate,
  formatBytes,
} from '@/lib/format';
import { uid } from '@/lib/utils';
import { toast } from '@/store/toast-store';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<LessonPlan['parsingStatus'], string> = {
  confirmed: 'Đã xác nhận',
  needs_review: 'Cần kiểm tra',
  failed: 'Phân tích lỗi',
  parsing: 'Đang phân tích',
  pending: 'Chờ xử lý',
};

function cloneLesson(lesson: LessonPlan): LessonPlan {
  return JSON.parse(JSON.stringify(lesson)) as LessonPlan;
}

function StringListEditor({
  label,
  hint,
  values,
  onChange,
  placeholder,
  addLabel = 'Thêm dòng',
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-[var(--text)]">{label}</p>
          {hint && <p className="text-[11px] text-[var(--muted)]">{hint}</p>}
        </div>
        <Button
          variant="ghost"
          size="xs"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => onChange([...values, ''])}
        >
          {addLabel}
        </Button>
      </div>
      {values.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border-soft)] px-3 py-2 text-[11.5px] text-[var(--muted)]">
          Chưa có nội dung. Nhấn “{addLabel}” để bổ sung.
        </p>
      ) : (
        <div className="space-y-1.5">
          {values.map((value, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <span className="w-5 shrink-0 text-center text-[10px] font-semibold text-[var(--muted)]">{index + 1}</span>
              <input
                className="field py-2 text-[12.5px]"
                value={value}
                placeholder={placeholder}
                onChange={(event) => {
                  const next = [...values];
                  next[index] = event.target.value;
                  onChange(next);
                }}
              />
              <IconButton
                aria-label={`Xóa dòng ${index + 1}`}
                size="sm"
                onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
                className="shrink-0 hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LessonReviewPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const lesson = useLiveQuery(() => (lessonId ? lessonRepo.get(lessonId) : Promise.resolve(undefined)), [lessonId]);
  const [draft, setDraft] = useState<LessonPlan | null>(null);
  const [tab, setTab] = useState('overview');
  const [openPhaseId, setOpenPhaseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removePhase, setRemovePhase] = useState<LessonPhase | null>(null);
  const [copied, setCopied] = useState(false);
  usePageTitle(lesson?.title ?? 'Kiểm tra kế hoạch bài dạy');

  useEffect(() => {
    if (lesson && (!draft || draft.id !== lesson.id)) {
      setDraft(cloneLesson(lesson));
      setOpenPhaseId(lesson.lessonPhases[0]?.id ?? null);
    }
  }, [draft, lesson]);

  if (lesson === undefined) {
    return (
      <div className="space-y-5">
        <PageHeader title="Kiểm tra kế hoạch bài dạy" />
        <LoadingState />
      </div>
    );
  }

  if (!lesson) {
    return (
      <GlassCard>
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="Không tìm thấy kế hoạch bài dạy"
          description="Bài này có thể đã bị xóa khỏi thiết bị."
          action={
            <Button onClick={() => navigate('/lessons')} icon={<ArrowLeft className="h-4 w-4" />}>
              Về thư viện
            </Button>
          }
        />
      </GlassCard>
    );
  }

  if (!draft) return <LoadingState label="Đang chuẩn bị bản chỉnh sửa…" />;

  const update = <K extends keyof LessonPlan,>(key: K, value: LessonPlan[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const updatePhase = (phaseId: string, patch: Partial<LessonPhase>) => {
    update(
      'lessonPhases',
      draft.lessonPhases.map((phase) => (phase.id === phaseId ? { ...phase, ...patch } : phase)),
    );
  };

  const addPhase = () => {
    const next: LessonPhase = {
      id: uid('phase'),
      order: draft.lessonPhases.length + 1,
      name: `Hoạt động ${draft.lessonPhases.length + 1}`,
      type: 'other',
      objective: '',
      teacherActions: [],
      studentActions: [],
      materials: [],
      questions: [],
      expectedResponses: [],
      completionCriteria: [],
      estimatedDurationMin: 10,
      confidence: 1,
      needsReview: false,
    };
    update('lessonPhases', [...draft.lessonPhases, next]);
    setOpenPhaseId(next.id);
  };

  const save = async (confirm: boolean): Promise<boolean> => {
    if (!draft.title.trim()) {
      toast.error('Thiếu tên bài học', 'Hãy nhập tên bài học trước khi lưu.');
      return false;
    }
    if (confirm && draft.lessonPhases.length === 0) {
      toast.error('Chưa có hoạt động', 'Cần ít nhất một hoạt động dạy học trước khi xác nhận.');
      return false;
    }
    const now = new Date().toISOString();
    const cleaned: LessonPlan = {
      ...draft,
      title: draft.title.trim(),
      topic: draft.topic.trim() || draft.title.trim(),
      lessonPhases: draft.lessonPhases.map((phase, index) => ({
        ...phase,
        order: index + 1,
        name: phase.name.trim() || `Hoạt động ${index + 1}`,
      })),
      objectives: draft.objectives.filter((objective) => objective.text.trim()),
      exercises: draft.exercises.filter((exercise) => exercise.prompt.trim() || exercise.expectedAnswer.trim()),
      updatedAt: now,
      parsingStatus: confirm ? 'confirmed' : draft.parsingStatus === 'failed' ? 'needs_review' : draft.parsingStatus,
      confirmedAt: confirm ? now : draft.confirmedAt,
    };
    await lessonRepo.save(cleaned);
    setDraft(cloneLesson(cleaned));
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ok = await save(false);
      if (ok) toast.success('Đã lưu thay đổi', 'Kế hoạch bài dạy được cập nhật trên thiết bị.');
    } catch (error) {
      console.error(error);
      toast.error('Không lưu được kế hoạch bài dạy');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const ok = await save(true);
      if (ok) {
        toast.success('Đã xác nhận kế hoạch bài dạy', 'Bạn có thể dùng bài này để luyện tập.');
        navigate(`/practice?lesson=${draft.id}`);
      }
    } catch (error) {
      console.error(error);
      toast.error('Không xác nhận được kế hoạch bài dạy');
    } finally {
      setConfirming(false);
    }
  };

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(draft.extractedText);
      setCopied(true);
      toast.success('Đã sao chép văn bản gốc');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Trình duyệt không cho phép sao chép tự động');
    }
  };

  const issues = draft.parsingIssues;
  const errorIssues = issues.filter((issue) => issue.severity === 'error');

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title={draft.title || 'Kế hoạch bài dạy chưa đặt tên'}
        eyebrow="Bước 2 · Kiểm tra kết quả trích xuất"
        description={`${draft.subject} · Lớp ${draft.grade} · ${draft.fileName}`}
        icon={<ClipboardList className="h-6 w-6" />}
        actions={
          <>
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/lessons')}>
              Thư viện
            </Button>
            <Button
              variant="secondary"
              icon={<Save className="h-4 w-4" />}
              loading={saving}
              onClick={() => void handleSave()}
            >
              Lưu thay đổi
            </Button>
            <Button
              variant="primary"
              icon={<Check className="h-4 w-4" />}
              loading={confirming}
              onClick={() => void handleConfirm()}
            >
              Xác nhận & luyện tập
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={draft.parsingStatus === 'confirmed' ? 'success' : draft.parsingStatus === 'failed' ? 'danger' : 'warning'} dot>
          {STATUS_LABEL[draft.parsingStatus]}
        </Badge>
        {draft.isDemo && <Badge tone="demo">DEMO · không tính vào thống kê</Badge>}
        <Badge tone="outline">Độ tin cậy {Math.round(draft.confidence * 100)}%</Badge>
        <Badge tone="neutral">{formatBytes(draft.fileSize)}</Badge>
        <span className="text-[11px] text-[var(--muted)]">Cập nhật {formatDate(draft.updatedAt, true)}</span>
      </div>

      {(errorIssues.length > 0 || issues.length > 0) && (
        <GlassCard className={cn(errorIssues.length > 0 && 'border-[var(--danger)]/25')}>
          <SectionHeader
            title="Vấn đề cần kiểm tra"
            description="Parser tự động có thể bỏ sót hoặc hiểu sai. Hãy sửa trực tiếp bên dưới nếu cần."
            icon={<AlertTriangle className="h-5 w-5" />}
            action={<Badge tone={errorIssues.length ? 'danger' : 'warning'}>{issues.length} mục</Badge>}
          />
          <div className="mt-3 grid gap-1.5 md:grid-cols-2">
            {issues.map((issue, index) => (
              <div
                key={`${issue.code}-${index}`}
                className={cn(
                  'rounded-lg px-3 py-2 text-[11.5px] leading-relaxed',
                  issue.severity === 'error'
                    ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
                    : issue.severity === 'warning'
                      ? 'bg-[var(--warning-soft)] text-[var(--warning)]'
                      : 'bg-[var(--info-soft)] text-[var(--info)]',
                )}
              >
                {issue.message}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Tổng quan', icon: <Info className="h-3.5 w-3.5" /> },
          { id: 'objectives', label: 'Mục tiêu & kiến thức', icon: <ListChecks className="h-3.5 w-3.5" /> },
          { id: 'phases', label: `Hoạt động (${draft.lessonPhases.length})`, icon: <Sparkles className="h-3.5 w-3.5" /> },
          { id: 'exercises', label: `Bài tập (${draft.exercises.length})` },
          { id: 'source', label: 'Văn bản gốc', icon: <FileText className="h-3.5 w-3.5" /> },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <GlassCard>
            <SectionHeader title="Thông tin bài dạy" description="Dùng để lớp học AI bám đúng nội dung." />
            <div className="mt-4 space-y-3">
              <Input
                label="Tên bài học"
                required
                value={draft.title}
                onChange={(event) => update('title', event.target.value)}
                placeholder="Ví dụ: Bài 54: Bảng nhân 3"
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <Select
                  label="Môn học"
                  value={draft.subject}
                  onChange={(event) => update('subject', event.target.value)}
                  options={(SUBJECT_OPTIONS.includes(draft.subject)
                    ? SUBJECT_OPTIONS
                    : [draft.subject, ...SUBJECT_OPTIONS]
                  ).map((subject) => ({ value: subject, label: subject }))}
                />
                <Select
                  label="Khối lớp"
                  value={String(draft.grade)}
                  onChange={(event) => update('grade', Number(event.target.value))}
                  options={GRADE_OPTIONS.map((grade) => ({ value: String(grade), label: `Lớp ${grade}` }))}
                />
                <Input
                  label="Chủ đề"
                  value={draft.topic}
                  onChange={(event) => update('topic', event.target.value)}
                  placeholder="Bảng nhân 3"
                />
              </div>
              <InfoNote>
                File <strong>{draft.fileName}</strong> được xử lý cục bộ. Bạn có thể xóa bài này bất cứ lúc nào trong
                thư viện mà không ảnh hưởng báo cáo cũ.
              </InfoNote>
            </div>
          </GlassCard>

          <div className="space-y-4">
            <GlassCard tone="accent">
              <SectionHeader title="Mức độ sẵn sàng" />
              <div className="mt-3 space-y-2 text-[12px]">
                {[
                  { label: 'Có tên bài', ok: Boolean(draft.title.trim()) },
                  { label: 'Có ít nhất 1 mục tiêu', ok: draft.objectives.length > 0 },
                  { label: 'Có ít nhất 1 hoạt động', ok: draft.lessonPhases.length > 0 },
                  { label: 'Có ít nhất 1 câu hỏi', ok: draft.lessonPhases.some((phase) => phase.questions.length > 0) },
                  { label: 'Đã xác nhận', ok: draft.parsingStatus === 'confirmed' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span
                      className={cn(
                        'grid h-5 w-5 place-items-center rounded-full',
                        item.ok ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--surface-muted)] text-[var(--muted)]',
                      )}
                    >
                      {item.ok ? <Check className="h-3 w-3" /> : <span className="h-1 w-1 rounded-full bg-current" />}
                    </span>
                    <span className={item.ok ? 'text-[var(--text)]' : 'text-[var(--text-2)]'}>{item.label}</span>
                  </div>
                ))}
              </div>
              <Button
                className="mt-4"
                variant="primary"
                fullWidth
                iconRight={<ArrowRight className="h-4 w-4" />}
                onClick={() => void handleConfirm()}
                loading={confirming}
              >
                Xác nhận & luyện tập
              </Button>
            </GlassCard>

            <GlassCard>
              <SectionHeader title="Tóm tắt nhanh" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { label: 'Mục tiêu', value: draft.objectives.length },
                  { label: 'Hoạt động', value: draft.lessonPhases.length },
                  { label: 'Câu hỏi', value: draft.lessonPhases.reduce((sum, phase) => sum + phase.questions.length, 0) },
                  { label: 'Bài tập', value: draft.exercises.length },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
                    <p className="font-display text-lg font-bold text-[var(--text)]">{item.value}</p>
                    <p className="text-[10.5px] text-[var(--muted)]">{item.label}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {tab === 'objectives' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard>
            <SectionHeader
              title="Mục tiêu bài học"
              description="Nêu rõ học sinh sẽ biết, hiểu hoặc làm được gì."
              action={
                <Button
                  variant="soft"
                  size="sm"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() =>
                    update('objectives', [
                      ...draft.objectives,
                      { id: uid('obj'), text: '', confidence: 1, needsReview: true },
                    ])
                  }
                >
                  Thêm mục tiêu
                </Button>
              }
            />
            <div className="mt-3 space-y-2">
              {draft.objectives.length === 0 && (
                <p className="rounded-xl bg-[var(--surface-muted)] px-3 py-4 text-[12px] text-[var(--text-2)]">
                  Chưa có mục tiêu. Hãy thêm ít nhất một mục tiêu để lớp học AI bám nội dung.
                </p>
              )}
              {draft.objectives.map((objective, index) => (
                <div key={objective.id} className="flex items-start gap-2 rounded-xl border border-[var(--border-soft)] p-2.5">
                  <span className="mt-2 w-5 shrink-0 text-center font-display text-[12px] font-bold text-[var(--accent-strong)]">
                    {index + 1}
                  </span>
                  <Textarea
                    rows={2}
                    value={objective.text}
                    placeholder="Ví dụ: Học sinh lập được bảng nhân 3 từ tổng các số hạng bằng nhau."
                    onChange={(event) =>
                      update(
                        'objectives',
                        draft.objectives.map((item) =>
                          item.id === objective.id ? { ...item, text: event.target.value } : item,
                        ),
                      )
                    }
                    className="flex-1"
                  />
                  <IconButton
                    aria-label={`Xóa mục tiêu ${index + 1}`}
                    size="sm"
                    onClick={() => update('objectives', draft.objectives.filter((item) => item.id !== objective.id))}
                    className="mt-2 shrink-0 hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              ))}
            </div>
          </GlassCard>

          <div className="space-y-4">
            <GlassCard>
              <StringListEditor
                label="Kiến thức trọng tâm"
                hint="Các khái niệm, quy tắc hoặc nội dung cốt lõi."
                values={draft.coreKnowledge}
                placeholder="Ví dụ: 3 × 1 = 3; 3 × 2 = 6…"
                onChange={(values) => update('coreKnowledge', values)}
                addLabel="Thêm kiến thức"
              />
            </GlassCard>
            <GlassCard>
              <StringListEditor
                label="Kiến thức nền cần có"
                hint="Điều học sinh cần biết trước bài này."
                values={draft.prerequisiteKnowledge}
                placeholder="Ví dụ: bảng nhân 2, phép cộng các số hạng bằng nhau"
                onChange={(values) => update('prerequisiteKnowledge', values)}
                addLabel="Thêm điều kiện"
              />
            </GlassCard>
            <GlassCard>
              <StringListEditor
                label="Đồ dùng dạy học"
                values={draft.teachingMaterials}
                placeholder="Ví dụ: bảng phụ, que tính, phiếu học tập"
                onChange={(values) => update('teachingMaterials', values)}
                addLabel="Thêm đồ dùng"
              />
            </GlassCard>
            <GlassCard>
              <StringListEditor
                label="Câu trả lời mong đợi"
                hint="Giúp AI học sinh phản hồi sát nội dung hơn."
                values={draft.expectedStudentResponses}
                placeholder="Ví dụ: 3 × 4 = 12 vì 3 + 3 + 3 + 3 = 12"
                onChange={(values) => update('expectedStudentResponses', values)}
                addLabel="Thêm câu trả lời"
              />
            </GlassCard>
            <GlassCard>
              <StringListEditor
                label="Tiêu chí đánh giá"
                values={draft.assessmentCriteria}
                placeholder="Ví dụ: Đọc đúng bảng nhân 3; giải đúng bài toán có một phép nhân"
                onChange={(values) => update('assessmentCriteria', values)}
                addLabel="Thêm tiêu chí"
              />
            </GlassCard>
          </div>
        </div>
      )}

      {tab === 'phases' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-[var(--text-2)]">
              {draft.lessonPhases.length} hoạt động. Mở từng thẻ để chỉnh nội dung mà lớp học AI sẽ dùng.
            </p>
            <Button variant="soft" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={addPhase}>
              Thêm hoạt động
            </Button>
          </div>
          {draft.lessonPhases.length === 0 && (
            <GlassCard>
              <EmptyState
                compact
                icon={<Sparkles className="h-6 w-6" />}
                title="Chưa có hoạt động dạy học"
                description="Thêm hoạt động để lớp học AI biết tiến trình bài dạy."
                action={<Button size="sm" onClick={addPhase}>Thêm hoạt động đầu tiên</Button>}
              />
            </GlassCard>
          )}
          {draft.lessonPhases.map((phase, index) => {
            const open = openPhaseId === phase.id;
            return (
              <GlassCard key={phase.id} padding="none" className="overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--accent-softer)]"
                  onClick={() => setOpenPhaseId(open ? null : phase.id)}
                  aria-expanded={open}
                >
                  <GripVertical className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] font-display text-[12px] font-bold text-[var(--accent-strong)]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{phase.name}</span>
                    <span className="block text-[11px] text-[var(--muted)]">
                      {PHASE_TYPE_SHORT[phase.type]} · {phase.estimatedDurationMin} phút · {phase.questions.length} câu hỏi
                    </span>
                  </span>
                  <Badge tone={phase.type === 'other' ? 'neutral' : 'accent'}>{PHASE_TYPE_LABELS[phase.type]}</Badge>
                  <span className="text-[var(--muted)]">{open ? '−' : '+'}</span>
                </button>

                {open && (
                  <div className="space-y-4 border-t border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-4">
                    <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr_120px]">
                      <Input
                        label="Tên hoạt động"
                        value={phase.name}
                        onChange={(event) => updatePhase(phase.id, { name: event.target.value })}
                      />
                      <Select
                        label="Loại hoạt động"
                        value={phase.type}
                        onChange={(event) => updatePhase(phase.id, { type: event.target.value as LessonPhaseType })}
                        options={Object.entries(PHASE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                      />
                      <Input
                        label="Thời lượng"
                        type="number"
                        min={1}
                        max={120}
                        value={phase.estimatedDurationMin}
                        onChange={(event) => updatePhase(phase.id, { estimatedDurationMin: Number(event.target.value) })}
                      />
                    </div>
                    <Textarea
                      label="Mục tiêu hoạt động"
                      rows={2}
                      value={phase.objective}
                      placeholder="Học sinh đạt được gì sau hoạt động này?"
                      onChange={(event) => updatePhase(phase.id, { objective: event.target.value })}
                    />
                    <div className="grid gap-4 lg:grid-cols-2">
                      <StringListEditor
                        label="Hoạt động của giáo viên"
                        values={phase.teacherActions}
                        placeholder="Ví dụ: Giới thiệu bảng nhân 3 bằng que tính"
                        onChange={(values) => updatePhase(phase.id, { teacherActions: values })}
                        addLabel="Thêm thao tác"
                      />
                      <StringListEditor
                        label="Hoạt động của học sinh"
                        values={phase.studentActions}
                        placeholder="Ví dụ: Lấy 3 que tính, lập phép nhân"
                        onChange={(values) => updatePhase(phase.id, { studentActions: values })}
                        addLabel="Thêm thao tác"
                      />
                      <StringListEditor
                        label="Câu hỏi dự kiến"
                        values={phase.questions}
                        placeholder="Ví dụ: 3 được lấy mấy lần?"
                        onChange={(values) => updatePhase(phase.id, { questions: values })}
                        addLabel="Thêm câu hỏi"
                      />
                      <StringListEditor
                        label="Câu trả lời mong đợi"
                        values={phase.expectedResponses}
                        placeholder="Ví dụ: 3 được lấy 4 lần, ta có 3 × 4 = 12"
                        onChange={(values) => updatePhase(phase.id, { expectedResponses: values })}
                        addLabel="Thêm câu trả lời"
                      />
                      <StringListEditor
                        label="Đồ dùng cho hoạt động"
                        values={phase.materials}
                        placeholder="Ví dụ: que tính, bảng phụ"
                        onChange={(values) => updatePhase(phase.id, { materials: values })}
                        addLabel="Thêm đồ dùng"
                      />
                      <StringListEditor
                        label="Tiêu chí hoàn thành"
                        values={phase.completionCriteria}
                        placeholder="Ví dụ: Học sinh lập đúng 3 × 4 = 12"
                        onChange={(values) => updatePhase(phase.id, { completionCriteria: values })}
                        addLabel="Thêm tiêu chí"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-3">
                      <Badge tone="neutral">Độ tin cậy trích xuất {Math.round(phase.confidence * 100)}%</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        className="text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                        onClick={() => setRemovePhase(phase)}
                      >
                        Xóa hoạt động
                      </Button>
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })}
          <div className="flex justify-center pt-1">
            <Button variant="soft" icon={<Plus className="h-4 w-4" />} onClick={addPhase}>
              Thêm hoạt động
            </Button>
          </div>
        </div>
      )}

      {tab === 'exercises' && (
        <GlassCard>
          <SectionHeader
            title="Bài tập và ví dụ"
            description="Dùng để học sinh AI luyện trả lời và giáo viên đặt câu hỏi."
            action={
              <Button
                variant="soft"
                size="sm"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() =>
                  update('exercises', [
                    ...draft.exercises,
                    { id: uid('exercise'), prompt: '', expectedAnswer: '', confidence: 1, needsReview: true },
                  ])
                }
              >
                Thêm bài tập
              </Button>
            }
          />
          <div className="mt-3 space-y-2.5">
            {draft.exercises.length === 0 && (
              <p className="rounded-xl bg-[var(--surface-muted)] px-3 py-4 text-[12px] text-[var(--text-2)]">
                Chưa có bài tập. Bạn vẫn có thể luyện tập, nhưng thêm bài tập giúp AI học sinh trả lời sát nội dung hơn.
              </p>
            )}
            {draft.exercises.map((exercise, index) => (
              <div key={exercise.id} className="rounded-2xl border border-[var(--border-soft)] p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12px] font-bold text-[var(--text)]">Bài tập {index + 1}</p>
                  <IconButton
                    aria-label={`Xóa bài tập ${index + 1}`}
                    size="sm"
                    onClick={() => update('exercises', draft.exercises.filter((item) => item.id !== exercise.id))}
                    className="hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Textarea
                    label="Đề bài / câu hỏi"
                    rows={2}
                    value={exercise.prompt}
                    onChange={(event) =>
                      update(
                        'exercises',
                        draft.exercises.map((item) =>
                          item.id === exercise.id ? { ...item, prompt: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Textarea
                    label="Đáp án mong đợi"
                    rows={2}
                    value={exercise.expectedAnswer}
                    onChange={(event) =>
                      update(
                        'exercises',
                        draft.exercises.map((item) =>
                          item.id === exercise.id ? { ...item, expectedAnswer: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {tab === 'source' && (
        <GlassCard>
          <SectionHeader
            title="Văn bản đã trích xuất"
            description="Giữ nguyên để đối chiếu. Không chỉnh sửa trực tiếp tại đây."
            icon={<FileText className="h-5 w-5" />}
            action={
              <Button variant="secondary" size="sm" icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} onClick={() => void copySource()}>
                {copied ? 'Đã sao chép' : 'Sao chép'}
              </Button>
            }
          />
          <pre className="thin-scrollbar mt-3 max-h-[560px] overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 font-mono text-[12px] leading-relaxed text-[var(--text-2)]">
            {draft.extractedText}
          </pre>
        </GlassCard>
      )}

      <div className="sticky bottom-20 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-3 shadow-[var(--shadow-lg)] backdrop-blur-xl lg:bottom-4">
        <p className="text-[11.5px] text-[var(--muted)]">
          {draft.parsingStatus === 'confirmed'
            ? 'Bài đã được xác nhận. Bạn có thể sửa và lưu lại bất cứ lúc nào.'
            : 'Hãy kiểm tra kỹ trước khi xác nhận. Bạn luôn là người quyết định nội dung cuối cùng.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<Save className="h-3.5 w-3.5" />} loading={saving} onClick={() => void handleSave()}>
            Lưu thay đổi
          </Button>
          <Button variant="primary" size="sm" icon={<Check className="h-3.5 w-3.5" />} loading={confirming} onClick={() => void handleConfirm()}>
            Xác nhận & luyện tập
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(removePhase)}
        onClose={() => setRemovePhase(null)}
        onConfirm={() => {
          if (!removePhase) return;
          update('lessonPhases', draft.lessonPhases.filter((phase) => phase.id !== removePhase.id));
          setRemovePhase(null);
        }}
        title="Xóa hoạt động?"
        message={removePhase ? `“${removePhase.name}” sẽ bị xóa khỏi kế hoạch bài dạy này.` : ''}
        confirmLabel="Xóa hoạt động"
      />
    </div>
  );
}
