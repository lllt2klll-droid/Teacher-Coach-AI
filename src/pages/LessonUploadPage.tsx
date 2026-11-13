import { useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  FileUp,
  Info,
  Loader2,
  Sparkles,
  UploadCloud,
  Type,
  X,
} from 'lucide-react';
import { PageHeader, Badge, GlassCard, SectionHeader } from '@/components/ui/Display';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Inputs';
import { InfoNote } from '@/components/ui/Overlay';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  ExtractionError,
  MAX_FILE_BYTES,
  extractTextFromFile,
  textFromPlainInput,
} from '@/services/lesson/extract-file';
import { parseLessonText } from '@/services/lesson/lesson-parser';
import { lessonRepo } from '@/data/repositories';
import type { LessonPlan } from '@/types/domain';
import { formatBytes } from '@/lib/format';
import { toast } from '@/store/toast-store';
import { cn } from '@/lib/utils';

type Mode = 'file' | 'text';

export function LessonUploadPage() {
  usePageTitle('Tải kế hoạch bài dạy');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<Mode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LessonPlan | null>(null);

  const selectFile = (next: File | null) => {
    setError(null);
    setResult(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      setError('File vượt quá 20MB. Hãy chọn file nhỏ hơn.');
      return;
    }
    const name = next.name.toLowerCase();
    if (!name.endsWith('.pdf') && !name.endsWith('.docx') && !name.endsWith('.txt')) {
      setError('Chỉ hỗ trợ PDF, DOCX và TXT. File .doc cũ cần lưu lại thành .docx.');
      return;
    }
    setFile(next);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const dropped = event.dataTransfer.files?.[0] ?? null;
    selectFile(dropped);
  };

  const handleAnalyze = async () => {
    setError(null);
    setResult(null);
    if (mode === 'file' && !file) {
      setError('Hãy chọn một file trước khi phân tích.');
      return;
    }
    if (mode === 'text' && text.trim().length < 40) {
      setError('Nội dung quá ngắn. Hãy dán ít nhất vài dòng mô tả kế hoạch bài dạy.');
      return;
    }
    setWorking(true);
    try {
      const extracted =
        mode === 'file' && file
          ? await extractTextFromFile(file)
          : await textFromPlainInput(text);
      const lesson = parseLessonText(extracted.text, {
        fileName: mode === 'file' && file ? file.name : 'Nội dung dán trực tiếp.txt',
        fileType: extracted.fileType,
        fileSize: mode === 'file' && file ? file.size : new Blob([text]).size,
      });
      if (extracted.warnings.length) {
        lesson.parsingIssues = [...extracted.warnings, ...lesson.parsingIssues];
      }
      await lessonRepo.save(lesson);
      setResult(lesson);
      toast.success(
        'Đã trích xuất kế hoạch bài dạy',
        `${lesson.lessonPhases.length} hoạt động, ${lesson.objectives.length} mục tiêu. Hãy kiểm tra trước khi xác nhận.`,
      );
    } catch (caught) {
      if (caught instanceof ExtractionError) {
        setError(caught.message);
      } else {
        console.error(caught);
        setError('Không phân tích được nội dung. Hãy kiểm tra file hoặc thử dán nội dung trực tiếp.');
      }
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="page-enter mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Tải kế hoạch bài dạy"
        eyebrow="Bước 1 · Học liệu"
        description="Tải file PDF, DOCX hoặc dán nội dung. Hệ thống trích xuất cấu trúc bài dạy ngay trên thiết bị, sau đó bạn kiểm tra và xác nhận."
        icon={<UploadCloud className="h-6 w-6" />}
        actions={
          <Button variant="ghost" onClick={() => navigate('/lessons')}>
            Về thư viện
          </Button>
        }
      />

      {!result ? (
        <>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-1.5 sm:max-w-md">
            <button
              type="button"
              onClick={() => {
                setMode('file');
                setError(null);
              }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-semibold transition-all',
                mode === 'file'
                  ? 'bg-[var(--surface-solid)] text-[var(--text)] shadow-[var(--shadow-sm)]'
                  : 'text-[var(--text-2)]',
              )}
            >
              <FileUp className="h-4 w-4" /> Tải file
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('text');
                setError(null);
              }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-semibold transition-all',
                mode === 'text'
                  ? 'bg-[var(--surface-solid)] text-[var(--text)] shadow-[var(--shadow-sm)]'
                  : 'text-[var(--text-2)]',
              )}
            >
              <Type className="h-4 w-4" /> Dán nội dung
            </button>
          </div>

          {mode === 'file' ? (
            <GlassCard>
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={cn(
                  'relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-12 text-center transition-colors',
                  dragOver
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--border-soft)] bg-[var(--surface-muted)]',
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="sr-only"
                  onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
                />
                {file ? (
                  <>
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--success-soft)] text-[var(--success)]">
                      <FileText className="h-7 w-7" />
                    </div>
                    <p className="mt-3 max-w-md break-all font-display text-[15px] font-bold text-[var(--text)]">{file.name}</p>
                    <p className="mt-1 text-[12px] text-[var(--muted)]">{formatBytes(file.size)}</p>
                    <div className="mt-3 flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
                        Chọn file khác
                      </Button>
                      <Button variant="ghost" size="sm" icon={<X className="h-3.5 w-3.5" />} onClick={() => setFile(null)}>
                        Bỏ chọn
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid h-16 w-16 place-items-center rounded-[22px] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                      <UploadCloud className="h-8 w-8" />
                    </div>
                    <h2 className="mt-3 font-display text-lg font-bold text-[var(--text)]">Kéo thả file vào đây</h2>
                    <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-[var(--text-2)]">
                      Hỗ trợ PDF có lớp văn bản, DOCX và TXT. Tối đa 20MB. File được xử lý cục bộ, không tải lên máy chủ.
                    </p>
                    <Button className="mt-4" icon={<FileUp className="h-4 w-4" />} onClick={() => inputRef.current?.click()}>
                      Chọn file từ thiết bị
                    </Button>
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="outline">PDF</Badge>
                <Badge tone="outline">DOCX</Badge>
                <Badge tone="outline">TXT</Badge>
                <Badge tone="warning">Không hỗ trợ .doc cũ</Badge>
                <Badge tone="neutral">Không hỗ trợ scan ảnh</Badge>
              </div>
            </GlassCard>
          ) : (
            <GlassCard>
              <SectionHeader
                title="Dán nội dung kế hoạch bài dạy"
                description="Phù hợp khi bạn có nội dung trong Word, Google Docs hoặc ghi chú."
                icon={<Type className="h-5 w-5" />}
              />
              <Textarea
                className="mt-4 min-h-[280px] font-mono text-[12.5px] leading-relaxed"
                label="Nội dung"
                placeholder={'Ví dụ:\nKẾ HOẠCH BÀI DẠY – MÔN TOÁN LỚP 2\nBài: Bảng nhân 3\nI. Mục tiêu: ...\nII. Đồ dùng dạy học: ...\nIII. Các hoạt động dạy học:\n1. Khởi động: ...\n2. Hình thành kiến thức: ...'}
                value={text}
                onChange={(event) => setText(event.target.value)}
                hint={`${text.trim().length.toLocaleString('vi-VN')} ký tự. Tối thiểu 40 ký tự.`}
              />
              {text.trim().length > 0 && (
                <div className="mt-2 flex justify-end">
                  <Button variant="ghost" size="sm" icon={<X className="h-3.5 w-3.5" />} onClick={() => setText('')}>
                    Xóa nội dung
                  </Button>
                </div>
              )}
            </GlassCard>
          )}

          {error && (
            <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-[12.5px] text-[var(--danger)]">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-[11.5px] leading-relaxed text-[var(--muted)]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Phân tích bằng quy tắc cục bộ, không gọi AI bên ngoài. Kết quả có thể cần chỉnh sửa; bạn luôn là người
                xác nhận cuối cùng.
              </span>
            </div>
            <Button
              variant="primary"
              size="lg"
              loading={working}
              icon={working ? undefined : <Sparkles className="h-4 w-4" />}
              onClick={() => void handleAnalyze()}
            >
              {working ? 'Đang trích xuất…' : 'Phân tích kế hoạch bài dạy'}
            </Button>
          </div>

          {working && (
            <GlassCard className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--accent-strong)]" />
              <div>
                <p className="text-[13px] font-semibold text-[var(--text)]">Đang đọc và tách cấu trúc bài dạy…</p>
                <p className="text-[11.5px] text-[var(--muted)]">File lớn có thể mất vài giây. Không đóng trang.</p>
              </div>
            </GlassCard>
          )}
        </>
      ) : (
        <GlassCard className="animate-pop">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--success-soft)] text-[var(--success)]">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <Badge tone="success">Đã trích xuất</Badge>
              <h2 className="mt-1.5 font-display text-lg font-bold text-[var(--text)]">{result.title}</h2>
              <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
                {result.subject} · Lớp {result.grade} · Độ tin cậy {Math.round(result.confidence * 100)}%
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Mục tiêu', value: result.objectives.length },
              { label: 'Hoạt động', value: result.lessonPhases.length },
              { label: 'Bài tập', value: result.exercises.length },
              { label: 'Vấn đề cần xem', value: result.parsingIssues.length },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
                <p className="font-display text-xl font-bold text-[var(--text)]">{item.value}</p>
                <p className="text-[10.5px] text-[var(--muted)]">{item.label}</p>
              </div>
            ))}
          </div>

          {result.parsingIssues.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {result.parsingIssues.slice(0, 4).map((issue, index) => (
                <div
                  key={`${issue.code}-${index}`}
                  className={cn(
                    'rounded-xl px-3 py-2 text-[11.5px] leading-relaxed',
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
          )}

          <InfoNote tone="warning">
            Kết quả trích xuất tự động có thể thiếu hoặc sai. Hãy kiểm tra mục tiêu, hoạt động và câu hỏi trước khi xác
            nhận. Chỉ kế hoạch đã xác nhận mới nên dùng để luyện tập.
          </InfoNote>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" iconRight={<ArrowRight className="h-4 w-4" />} onClick={() => navigate(`/lessons/${result.id}/review`)}>
              Kiểm tra & xác nhận
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setResult(null);
                setFile(null);
                setText('');
                setError(null);
              }}
            >
              Tải bài khác
            </Button>
            <Button variant="ghost" onClick={() => navigate('/lessons')}>
              Về thư viện
            </Button>
          </div>
        </GlassCard>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {[
          {
            title: 'Cấu trúc rõ ràng',
            text: 'Đặt tên hoạt động theo “Khởi động”, “Khám phá”, “Luyện tập”, “Vận dụng” để parser nhận diện đúng.',
          },
          {
            title: 'Có câu hỏi dự kiến',
            text: 'Ghi câu hỏi và câu trả lời mong đợi trong từng hoạt động để lớp học AI phản hồi sát nội dung.',
          },
          {
            title: 'Không gửi file đi đâu',
            text: 'Trích xuất PDF/DOCX diễn ra trong trình duyệt. File không được tải lên máy chủ Teacher Coach AI.',
          },
        ].map((tip) => (
          <div key={tip.title} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3.5">
            <p className="text-[12px] font-semibold text-[var(--text)]">{tip.title}</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--text-2)]">{tip.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
