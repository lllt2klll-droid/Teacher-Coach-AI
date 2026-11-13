import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen,
  Copy,
  FileCheck2,
  FileWarning,
  MonitorPlay,
  Plus,
  Search,
  Trash2,
  Upload,
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
import { Input, Select } from '@/components/ui/Inputs';
import { ConfirmDialog, InfoNote } from '@/components/ui/Overlay';
import { PageHeader as _PageHeader } from '@/components/ui/Display';
import { usePageTitle } from '@/hooks/usePageTitle';
import { lessonRepo } from '@/data/repositories';
import type { LessonPlan } from '@/types/domain';
import { formatDate, formatBytes } from '@/lib/format';
import { normalizeSearch } from '@/components/layout/AppShell';
import { toast } from '@/store/toast-store';
import { cn } from '@/lib/utils';

const STATUS_META: Record<
  LessonPlan['parsingStatus'],
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'accent' }
> = {
  confirmed: { label: 'Đã xác nhận', tone: 'success' },
  needs_review: { label: 'Cần kiểm tra', tone: 'warning' },
  failed: { label: 'Phân tích lỗi', tone: 'danger' },
  parsing: { label: 'Đang phân tích', tone: 'accent' },
  pending: { label: 'Chờ xử lý', tone: 'neutral' },
};

type StatusFilter = 'all' | 'confirmed' | 'needs_review';

export function LessonsPage() {
  usePageTitle('Thư viện kế hoạch bài dạy');
  const navigate = useNavigate();
  const lessons = useLiveQuery(() => lessonRepo.list(), []);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [subject, setSubject] = useState('all');
  const [pendingDelete, setPendingDelete] = useState<LessonPlan | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const allLessons = lessons ?? [];
  const subjects = useMemo(
    () => Array.from(new Set(allLessons.map((lesson) => lesson.subject))).sort(),
    [allLessons],
  );

  const filtered = useMemo(() => {
    const needle = normalizeSearch(deferredQuery);
    return allLessons.filter((lesson) => {
      if (status === 'confirmed' && lesson.parsingStatus !== 'confirmed') return false;
      if (
        status === 'needs_review' &&
        lesson.parsingStatus !== 'needs_review' &&
        lesson.parsingStatus !== 'failed'
      ) {
        return false;
      }
      if (subject !== 'all' && lesson.subject !== subject) return false;
      if (!needle) return true;
      return normalizeSearch(
        `${lesson.title} ${lesson.subject} ${lesson.topic} ${lesson.fileName} lớp ${lesson.grade}`,
      ).includes(needle);
    });
  }, [allLessons, deferredQuery, status, subject]);

  const realCount = allLessons.filter((lesson) => !lesson.isDemo).length;
  const reviewCount = allLessons.filter(
    (lesson) => !lesson.isDemo && (lesson.parsingStatus === 'needs_review' || lesson.parsingStatus === 'failed'),
  ).length;

  const handleDuplicate = async (lesson: LessonPlan) => {
    setDuplicatingId(lesson.id);
    try {
      const copy = await lessonRepo.duplicate(lesson.id);
      if (!copy) {
        toast.error('Không tìm thấy kế hoạch để nhân bản');
        return;
      }
      toast.success('Đã nhân bản kế hoạch bài dạy', copy.title);
      navigate(`/lessons/${copy.id}/review`);
    } catch (error) {
      console.error(error);
      toast.error('Không nhân bản được kế hoạch bài dạy');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await lessonRepo.remove(pendingDelete.id);
      toast.success('Đã xóa kế hoạch bài dạy', pendingDelete.title);
      setPendingDelete(null);
    } catch (error) {
      console.error(error);
      toast.error('Không xóa được kế hoạch bài dạy');
    } finally {
      setDeleting(false);
    }
  };

  if (!lessons) {
    return (
      <div className="space-y-5">
        <PageHeader title="Thư viện kế hoạch bài dạy" description="Đang tải dữ liệu…" />
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="Thư viện kế hoạch bài dạy"
        eyebrow="Học liệu của bạn"
        description={`${realCount} kế hoạch thật${reviewCount ? ` · ${reviewCount} cần kiểm tra` : ' · tất cả đã xác nhận'}. Dữ liệu lưu cục bộ trong trình duyệt.`}
        icon={<BookOpen className="h-6 w-6" />}
        actions={
          <>
            <Button variant="secondary" icon={<MonitorPlay className="h-4 w-4" />} onClick={() => navigate('/practice')}>
              Vào luyện tập
            </Button>
            <Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => navigate('/lessons/upload')}>
              Tải kế hoạch bài dạy
            </Button>
          </>
        }
      />

      <GlassCard>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <Input
            label="Tìm kiếm"
            placeholder="Tên bài, môn học, chủ đề…"
            leading={<Search className="h-4 w-4" />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1"
          />
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Select
              label="Trạng thái"
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              options={[
                { value: 'all', label: 'Tất cả' },
                { value: 'confirmed', label: 'Đã xác nhận' },
                { value: 'needs_review', label: 'Cần kiểm tra' },
              ]}
              className="min-w-[150px]"
            />
            <Select
              label="Môn học"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              options={[{ value: 'all', label: 'Tất cả môn' }, ...subjects.map((item) => ({ value: item, label: item }))]}
              className="min-w-[150px]"
            />
          </div>
        </div>
      </GlassCard>

      {allLessons.some((lesson) => lesson.isDemo) && (
        <InfoNote>
          <strong>Kế hoạch DEMO</strong> được gắn nhãn và tách khỏi thống kê thật. Bạn có thể xóa hoặc khôi phục trong
          Cài đặt. Hệ thống không tạo buổi luyện, điểm số hay nhận xét giả từ bài DEMO.
        </InfoNote>
      )}

      {filtered.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={<BookOpen className="h-6 w-6" />}
            title={allLessons.length === 0 ? 'Thư viện đang trống' : 'Không có kết quả phù hợp'}
            description={
              allLessons.length === 0
                ? 'Tải file PDF, DOCX hoặc TXT để bắt đầu. Hệ thống sẽ trích xuất mục tiêu, hoạt động và câu hỏi để bạn kiểm tra.'
                : 'Thử xóa bộ lọc hoặc tìm bằng từ khóa khác.'
            }
            action={
              allLessons.length === 0 ? (
                <Button icon={<Upload className="h-4 w-4" />} onClick={() => navigate('/lessons/upload')}>
                  Tải kế hoạch bài dạy đầu tiên
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('');
                    setStatus('all');
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((lesson) => {
            const meta = STATUS_META[lesson.parsingStatus];
            return (
              <GlassCard key={lesson.id} hover className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {lesson.isDemo && <Badge tone="demo">DEMO</Badge>}
                    <Badge tone="outline">Lớp {lesson.grade}</Badge>
                  </div>
                  <span className="shrink-0 text-[10.5px] font-semibold text-[var(--muted)]">{lesson.subject}</span>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/lessons/${lesson.id}/review`)}
                  className="mt-2.5 block text-left"
                >
                  <h3 className="line-clamp-2 font-display text-[16px] font-bold leading-snug text-[var(--text)] hover:text-[var(--accent-strong)]">
                    {lesson.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--text-2)]">
                    {lesson.objectives[0]?.text || 'Chưa trích xuất được mục tiêu. Mở để kiểm tra và bổ sung.'}
                  </p>
                </button>

                <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-lg bg-[var(--surface-muted)] px-1 py-1.5">
                    <p className="font-display text-[15px] font-bold text-[var(--text)]">{lesson.lessonPhases.length}</p>
                    <p className="text-[9.5px] text-[var(--muted)]">Hoạt động</p>
                  </div>
                  <div className="rounded-lg bg-[var(--surface-muted)] px-1 py-1.5">
                    <p className="font-display text-[15px] font-bold text-[var(--text)]">{lesson.exercises.length}</p>
                    <p className="text-[9.5px] text-[var(--muted)]">Bài tập</p>
                  </div>
                  <div className="rounded-lg bg-[var(--surface-muted)] px-1 py-1.5">
                    <p className="font-display text-[15px] font-bold text-[var(--text)]">
                      {Math.round(lesson.confidence * 100)}%
                    </p>
                    <p className="text-[9.5px] text-[var(--muted)]">Độ tin cậy</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-[10.5px] text-[var(--muted)]">
                  {lesson.parsingStatus === 'confirmed' ? (
                    <FileCheck2 className="h-3.5 w-3.5 text-[var(--success)]" />
                  ) : (
                    <FileWarning className="h-3.5 w-3.5 text-[var(--warning)]" />
                  )}
                  <span className="truncate">{lesson.fileName}</span>
                  <span>·</span>
                  <span className="shrink-0">{formatBytes(lesson.fileSize)}</span>
                </div>
                <p className="mt-1 text-[10.5px] text-[var(--muted)]">Cập nhật {formatDate(lesson.updatedAt, true)}</p>

                <div className="mt-auto flex items-center gap-1.5 pt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate(`/lessons/${lesson.id}/review`)}
                  >
                    {lesson.parsingStatus === 'confirmed' ? 'Xem & chỉnh sửa' : 'Kiểm tra'}
                  </Button>
                  <Button
                    variant="soft"
                    size="sm"
                    icon={<MonitorPlay className="h-3.5 w-3.5" />}
                    onClick={() => navigate(`/practice?lesson=${lesson.id}`)}
                    aria-label={`Luyện tập với ${lesson.title}`}
                  >
                    Luyện
                  </Button>
                  <IconButton
                    aria-label={`Nhân bản ${lesson.title}`}
                    size="sm"
                    onClick={() => void handleDuplicate(lesson)}
                    disabled={duplicatingId === lesson.id}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    aria-label={`Xóa ${lesson.title}`}
                    size="sm"
                    onClick={() => setPendingDelete(lesson)}
                    className="hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <GlassCard>
        <SectionHeader
          title="Mẹo để phân tích tốt hơn"
          description="Kế hoạch bài dạy càng rõ cấu trúc, phần trích xuất càng chính xác."
          icon={<Plus className="h-5 w-5" />}
        />
        <ul className="mt-3 grid gap-2 text-[12px] leading-relaxed text-[var(--text-2)] md:grid-cols-2">
          <li className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
            Dùng tiêu đề hoạt động như “Hoạt động 1: Khởi động”, “Hình thành kiến thức”, “Luyện tập”, “Vận dụng”.
          </li>
          <li className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
            Ghi rõ mục tiêu, câu hỏi dự kiến và câu trả lời mong đợi trong từng hoạt động.
          </li>
          <li className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
            File scan ảnh có thể không trích xuất được chữ. Hãy dùng bản PDF có lớp văn bản hoặc DOCX.
          </li>
          <li className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
            Sau khi tải lên, luôn kiểm tra lại mục tiêu và hoạt động trước khi xác nhận.
          </li>
        </ul>
      </GlassCard>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Xóa kế hoạch bài dạy?"
        message={
          pendingDelete
            ? `“${pendingDelete.title}” sẽ bị xóa khỏi thiết bị. Các buổi luyện và báo cáo đã tạo từ bài này vẫn được giữ lại.`
            : ''
        }
        confirmLabel="Xóa"
      />
    </div>
  );
}
