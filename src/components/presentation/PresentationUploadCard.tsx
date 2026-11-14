import { useEffect, useRef, useState, type DragEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  FileUp,
  Loader2,
  MonitorPlay,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { Badge, Progress } from '@/components/ui/Display';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, InfoNote } from '@/components/ui/Overlay';
import { presentationRepo } from '@/data/repositories';
import {
  MAX_PPTX_BYTES,
  PresentationParseError,
  parsePptxFile,
  type PresentationParseProgress,
} from '@/services/presentation/pptx-parser';
import {
  MAX_PDF_BYTES,
  PdfVisualError,
  renderPdfVisual,
  type PdfVisualProgress,
} from '@/services/presentation/pdf-visual';
import type { PresentationDoc } from '@/types/domain';
import { formatBytes, formatDate } from '@/lib/format';
import { toast } from '@/store/toast-store';
import { cn } from '@/lib/utils';

interface PresentationUploadCardProps {
  lessonPlanId: string | null;
  presentation?: PresentationDoc | null;
  onSaved?: (presentation: PresentationDoc) => void;
  onRemoved?: () => void;
  compact?: boolean;
}

function errorMessage(error: unknown): string {
  if (error instanceof PresentationParseError) return error.message;
  if (error instanceof PdfVisualError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Không đọc được file PPTX. Hãy kiểm tra lại file rồi thử lại.';
}

function pdfErrorMessage(error: unknown): string {
  if (error instanceof PdfVisualError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Không đọc được file PDF. Hãy kiểm tra file hoặc xuất lại từ PowerPoint.';
}

export function PresentationUploadCard({
  lessonPlanId,
  presentation,
  onSaved,
  onRemoved,
  compact = false,
}: PresentationUploadCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState<PresentationParseProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<PdfVisualProgress | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfRemoveOpen, setPdfRemoveOpen] = useState(false);
  const [pdfRemoving, setPdfRemoving] = useState(false);
  const pdfTextPages = presentation?.slides.filter((slide) => slide.visualText?.trim()).length ?? 0;

  useEffect(() => {
    setError(null);
    setProgress(null);
    setPendingFile(null);
    setReplaceOpen(false);
    setRemoveOpen(false);
    setPdfError(null);
    setPdfProgress(null);
    setPdfRemoveOpen(false);
  }, [lessonPlanId]);

  const importFile = async (file: File) => {
    if (!lessonPlanId) return;
    setParsing(true);
    setError(null);
    setProgress({ value: 0, stage: 'reading', message: 'Đang chuẩn bị đọc file…' });
    try {
      const draft = await parsePptxFile(file, {
        onProgress: (next) => setProgress(next),
      });
      const saved = await presentationRepo.saveForLesson(lessonPlanId, draft);
      onSaved?.(saved);
      toast.success('Đã lưu bài trình chiếu', `${saved.slides.length} slide được xử lý hoàn toàn trên thiết bị này.`);
    } catch (importError) {
      console.error(importError);
      setError(errorMessage(importError));
    } finally {
      setParsing(false);
      setProgress(null);
    }
  };

  const importPdf = async (file: File) => {
    if (!lessonPlanId || !presentation) return;
    setPdfParsing(true);
    setPdfError(null);
    setPdfProgress({ value: 0.01, message: 'Đang chuẩn bị đọc PDF…' });
    try {
      const rendered = await renderPdfVisual(file, {
        slideCount: presentation.slides.length,
        slideAspect: presentation.slideWidthEmu / Math.max(1, presentation.slideHeightEmu),
        onProgress: (next) => setPdfProgress(next),
      });
      const saved = await presentationRepo.attachVisualPdf(lessonPlanId, rendered);
      onSaved?.(saved);
      toast.success(
        'Đã dùng PDF làm bản hiển thị gốc',
        `${rendered.pageCount} trang đã được lưu cục bộ. AI đọc văn bản của trang PDF đang chiếu.`,
      );
    } catch (pdfImportError) {
      console.error(pdfImportError);
      setPdfError(pdfErrorMessage(pdfImportError));
    } finally {
      setPdfParsing(false);
      setPdfProgress(null);
    }
  };

  const handleRemovePdf = async () => {
    if (!lessonPlanId) return;
    setPdfRemoving(true);
    try {
      await presentationRepo.removeVisualPdf(lessonPlanId);
      setPdfRemoveOpen(false);
      toast.info('Đã bỏ bản PDF', 'Slide quay lại bản mô phỏng từ PPTX. Ảnh PDF đã được xóa khỏi thiết bị.');
    } catch (removeError) {
      console.error(removeError);
      toast.error('Không bỏ được bản PDF');
    } finally {
      setPdfRemoving(false);
    }
  };

  const chooseFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pptx')) {
      setError('Chỉ hỗ trợ file .pptx. File .ppt cũ cần được lưu lại thành .pptx trước khi tải.');
      return;
    }
    if (file.size > MAX_PPTX_BYTES) {
      setError(`File PPTX vượt quá ${Math.round(MAX_PPTX_BYTES / 1024 / 1024)}MB. Hãy chọn file nhỏ hơn.`);
      return;
    }
    setError(null);
    if (presentation) {
      setPendingFile(file);
      setReplaceOpen(true);
      return;
    }
    void importFile(file);
  };

  const handleInput = (files: FileList | null) => {
    const file = files?.[0];
    if (file) chooseFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (parsing) return;
    const file = event.dataTransfer.files?.[0];
    if (file) chooseFile(file);
  };

  const handleRemove = async () => {
    if (!lessonPlanId) return;
    setRemoving(true);
    try {
      await presentationRepo.removeForLesson(lessonPlanId);
      setRemoveOpen(false);
      onRemoved?.();
      toast.info('Đã xóa bài trình chiếu', 'Dữ liệu slide đã được xóa khỏi thiết bị này.');
    } catch (removeError) {
      console.error(removeError);
      toast.error('Không xóa được bài trình chiếu');
    } finally {
      setRemoving(false);
    }
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
      className="hidden"
      onChange={(event) => {
        handleInput(event.target.files);
        event.target.value = '';
      }}
    />
  );

  const pdfInput = (
    <input
      ref={pdfInputRef}
      type="file"
      accept=".pdf,application/pdf"
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void importPdf(file);
      }}
    />
  );

  if (!lessonPlanId) {
    return (
      <InfoNote>
        Chọn một kế hoạch bài dạy trước khi tải file PPTX. Bài trình chiếu được gắn với đúng bài dạy đã chọn.
      </InfoNote>
    );
  }

  const pptxImageCount = presentation
    ? presentation.assets.filter((asset) => !asset.partPath.startsWith('pdf/')).length
    : 0;

  return (
    <div className={cn('space-y-3', compact && 'space-y-2.5')}>
      {input}
      {pdfInput}

      {presentation ? (
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
          <div className="flex flex-wrap items-start gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <MonitorPlay className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-bold text-[var(--text)]">{presentation.fileName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge tone="success" dot>
                  Đã tải cục bộ
                </Badge>
                <Badge tone="neutral">{presentation.slides.length} slide</Badge>
                <Badge tone="neutral">{formatBytes(presentation.fileSize)}</Badge>
                {pptxImageCount > 0 && <Badge tone="outline">{pptxImageCount} ảnh PPTX</Badge>}
                {presentation.visualMode === 'pdf' && <Badge tone="success">PDF gốc</Badge>}
              </div>
              <p className="mt-1 text-[10.5px] text-[var(--muted)]">
                Cập nhật {formatDate(presentation.updatedAt, true)} · {presentation.warnings.length} cảnh báo
              </p>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Button
              size="xs"
              variant="secondary"
              icon={<FileUp className="h-3.5 w-3.5" />}
              disabled={parsing}
              onClick={() => inputRef.current?.click()}
            >
              Thay PPTX
            </Button>
            <Button
              size="xs"
              variant="ghost"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              disabled={parsing}
              onClick={() => setRemoveOpen(true)}
            >
              Xóa bài trình chiếu
            </Button>
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--success)]">
              <CheckCircle2 className="h-3 w-3" /> Sẵn sàng trình chiếu
            </span>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="Tải file PPTX"
          onClick={() => !parsing && inputRef.current?.click()}
          onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ' ') && !parsing) {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!parsing) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'grid cursor-pointer place-items-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors',
            dragging
              ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
              : 'border-[var(--border-soft)] bg-[var(--surface-muted)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent-softer)]',
            parsing && 'pointer-events-none opacity-70',
          )}
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            {parsing ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
          </span>
          <p className="mt-2 text-[12.5px] font-bold text-[var(--text)]">
            {parsing ? 'Đang đọc bài trình chiếu…' : 'Kéo thả hoặc bấm để chọn file .pptx'}
          </p>
          <p className="mt-1 max-w-sm text-[10.5px] leading-relaxed text-[var(--muted)]">
            Slide được đọc ngay trong trình duyệt. File gốc không được tải lên máy chủ và không được lưu lại.
          </p>
        </div>
      )}

      {presentation && (
        presentation.visualMode === 'pdf' ? (
          <div className="rounded-xl border border-[var(--success)]/25 bg-[var(--success-soft)] p-3">
            <div className="flex flex-wrap items-start gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--success)]/15 text-[var(--success)]">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[12.5px] font-bold text-[var(--text)]">Đang hiển thị bản PDF gốc</p>
                  <Badge tone="success" dot>
                    Giống PowerPoint
                  </Badge>
                </div>
                <p className="truncate text-[10.5px] text-[var(--muted)]">
                  {presentation.visualFileName ?? 'ban-xuat-powerpoint.pdf'} · {presentation.visualPageCount ?? 0} trang
                </p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-[var(--text-2)]">
                  Slide được hiển thị từ ảnh PDF xuất bởi PowerPoint; AI đọc văn bản của trang đang chiếu (từ PDF nếu
                  có, nếu không từ PPTX). File PDF gốc không được lưu lại.
                </p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-[var(--text-2)]">
                  {pdfTextPages > 0
                    ? `AI đọc được văn bản ${pdfTextPages}/${presentation.slides.length} trang PDF.`
                    : 'PDF này chưa có văn bản trích xuất (PDF cũ hoặc chỉ có ảnh); AI đang dùng văn bản PPTX. Nếu PDF có text layer, bấm “Thay PDF” để AI đọc đúng trang.'}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Button
                size="xs"
                variant="secondary"
                icon={<FileUp className="h-3.5 w-3.5" />}
                disabled={pdfParsing}
                loading={pdfParsing}
                onClick={() => pdfInputRef.current?.click()}
              >
                Thay PDF
              </Button>
              <Button
                size="xs"
                variant="ghost"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                disabled={pdfParsing}
                onClick={() => setPdfRemoveOpen(true)}
              >
                Bỏ bản PDF
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
            <div className="flex items-start gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-bold text-[var(--text)]">Hiển thị giống bản gốc (khuyến nghị)</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-[var(--text-2)]">
                  Mở chính file PPTX trong PowerPoint → Save As → PDF, rồi tải PDF tại đây. Hệ thống chỉ lưu ảnh từng
                  trang, không lưu file PDF gốc và không tải lên máy chủ.
                </p>
              </div>
            </div>
            <Button
              size="xs"
              variant="soft"
              className="mt-2"
              icon={<FileUp className="h-3.5 w-3.5" />}
              disabled={pdfParsing}
              loading={pdfParsing}
              onClick={() => pdfInputRef.current?.click()}
            >
              Tải PDF xuất từ PowerPoint
            </Button>
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">
              Không bắt buộc. Nếu chưa có PDF, slide dùng bản mô phỏng từ PPTX (có thể lệch font hoặc bố cục).
            </p>
          </div>
        )
      )}

      {pdfParsing && pdfProgress && (
        <Progress
          value={Math.round(pdfProgress.value * 100)}
          label="Đang chuyển PDF thành ảnh slide"
          hint={pdfProgress.message}
          size="sm"
          showValue
        />
      )}

      {pdfError && (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-3 py-2 text-[11.5px] leading-relaxed text-[var(--danger)]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{pdfError}</span>
        </div>
      )}

      {parsing && progress && (
        <Progress
          value={Math.round(progress.value * 100)}
          label={progress.stage === 'slides' ? 'Đang trích xuất slide' : 'Đang đọc PPTX'}
          hint={progress.message}
          size="sm"
          showValue
        />
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-3 py-2 text-[11.5px] leading-relaxed text-[var(--danger)]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {presentation && presentation.warnings.length > 0 && (
        <details className="rounded-xl bg-[var(--warning-soft)] px-3 py-2 text-[11px] leading-relaxed text-[var(--warning)]">
          <summary className="cursor-pointer font-semibold">
            {presentation.warnings.length} cảnh báo khi đọc slide (bố cục có thể khác PowerPoint)
          </summary>
          <ul className="mt-1.5 space-y-1">
            {presentation.warnings.slice(0, 8).map((warning, index) => (
              <li key={`${warning.code}-${index}`} className="flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-current" />
                <span className="text-[var(--text-2)]">{warning.message}</span>
              </li>
            ))}
          </ul>
          {presentation.warnings.length > 8 && (
            <p className="mt-1 text-[10px] text-[var(--muted)]">Còn {presentation.warnings.length - 8} cảnh báo khác.</p>
          )}
        </details>
      )}

      {presentation && presentation.visualWarnings && presentation.visualWarnings.length > 0 && (
        <details className="rounded-xl bg-[var(--warning-soft)] px-3 py-2 text-[11px] leading-relaxed text-[var(--warning)]">
          <summary className="cursor-pointer font-semibold">
            {presentation.visualWarnings.length} lưu ý khi dùng PDF làm bản hiển thị
          </summary>
          <ul className="mt-1.5 space-y-1">
            {presentation.visualWarnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`} className="flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-current" />
                <span className="text-[var(--text-2)]">{warning.message}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">
        Chỉ hỗ trợ PPTX tối đa {Math.round(MAX_PPTX_BYTES / 1024 / 1024)}MB và PDF tối đa{' '}
        {Math.round(MAX_PDF_BYTES / 1024 / 1024)}MB. Bố cục PPTX được mô phỏng gần đúng; biểu đồ và hiệu ứng chuyển
        động không được tái tạo. PDF (tuỳ chọn) chỉ dùng để hiển thị slide giống bản gốc. Dữ liệu slide không nằm trong
        bản sao lưu.
      </p>

      <ConfirmDialog
        open={replaceOpen}
        onClose={() => {
          setReplaceOpen(false);
          setPendingFile(null);
        }}
        onConfirm={() => {
          const file = pendingFile;
          setReplaceOpen(false);
          setPendingFile(null);
          if (file) void importFile(file);
        }}
        title="Thay bài trình chiếu hiện tại?"
        message="Bài trình chiếu cũ của bài dạy này sẽ bị thay bằng file mới. Nếu đang dùng PDF gốc, bản PDF cũng sẽ bị bỏ và cần tải lại cho file PPTX mới."
        confirmLabel="Đọc và thay PPTX"
        tone="primary"
      />

      <ConfirmDialog
        open={pdfRemoveOpen}
        onClose={() => setPdfRemoveOpen(false)}
        onConfirm={() => void handleRemovePdf()}
        loading={pdfRemoving}
        title="Bỏ bản PDF gốc?"
        message="Ảnh từng trang PDF sẽ bị xóa khỏi thiết bị. Slide quay lại bản mô phỏng từ PPTX và AI đọc văn bản PPTX."
        confirmLabel="Bỏ bản PDF"
      />

      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={() => void handleRemove()}
        loading={removing}
        title="Xóa bài trình chiếu?"
        message="Toàn bộ dữ liệu slide và ảnh đã trích xuất của bài dạy này sẽ bị xóa khỏi thiết bị."
        confirmLabel="Xóa bài trình chiếu"
      />
    </div>
  );
}
