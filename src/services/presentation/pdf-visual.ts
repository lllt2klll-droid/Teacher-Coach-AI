import type {
  ParsingIssue,
  PresentationAsset,
  PresentationDoc,
  PresentationSlide,
} from '@/types/domain';
import { uid } from '@/lib/utils';

/**
 * Turns a PDF exported from the same PowerPoint file into full-slide images.
 *
 * PowerPoint itself is the only renderer that can reproduce a .pptx exactly,
 * so the teacher can optionally attach the PDF exported from PowerPoint. The
 * PDF is read in the browser and only the rendered page JPEGs are persisted in
 * IndexedDB; the PDF file itself is never stored or uploaded. Text and the AI
 * context still come from the PPTX parser, so the two files stay independent.
 */

export const MAX_PDF_BYTES = 80 * 1024 * 1024;
const MAX_PAGES = 120;
const RENDER_WIDTH = 1600;
const MAX_RENDER_DIMENSION = 2400;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;
const JPEG_QUALITY = 0.9;
const ASPECT_TOLERANCE = 0.08;

export interface PdfVisualProgress {
  value: number;
  message: string;
  page?: number;
  total?: number;
}

export interface RenderedPdfVisual {
  fileName: string;
  fileSize: number;
  pageCount: number;
  assets: PresentationAsset[];
  /** Asset id for each rendered page, in page order (missing pages are skipped). */
  pageAssetIds: string[];
  warnings: ParsingIssue[];
}

export type PdfVisualErrorCode =
  | 'invalid_pdf'
  | 'pdf_too_large'
  | 'pdf_password'
  | 'pdf_unreadable'
  | 'pdf_no_pages';

export class PdfVisualError extends Error {
  readonly code: PdfVisualErrorCode;

  constructor(code: PdfVisualErrorCode, message: string) {
    super(message);
    this.name = 'PdfVisualError';
    this.code = code;
  }
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Không tạo được ảnh từ trang PDF.'));
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

export interface RenderPdfVisualOptions {
  /** Number of slides in the PPTX; extra PDF pages are ignored. */
  slideCount: number;
  /** Width / height of the PPTX slide, used to warn about a different page shape. */
  slideAspect?: number;
  onProgress?: (progress: PdfVisualProgress) => void;
}

export async function renderPdfVisual(
  file: File,
  options: RenderPdfVisualOptions,
): Promise<RenderedPdfVisual> {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    throw new PdfVisualError('invalid_pdf', 'Chỉ hỗ trợ file PDF xuất từ PowerPoint (.pdf).');
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new PdfVisualError(
      'pdf_too_large',
      `File PDF vượt quá ${Math.round(MAX_PDF_BYTES / 1024 / 1024)}MB. Hãy xuất PDF ở chất lượng vừa phải.`,
    );
  }

  options.onProgress?.({ value: 0.02, message: 'Đang mở PDF…' });
  const [pdfjs, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;

  const data = new Uint8Array(await file.arrayBuffer());
  let loadingTask: ReturnType<typeof pdfjs.getDocument> | null = null;
  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']> | null = null;

  try {
    try {
      loadingTask = pdfjs.getDocument({ data });
      doc = await loadingTask.promise;
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'PasswordException') {
        throw new PdfVisualError(
          'pdf_password',
          'PDF đang được bảo vệ bằng mật khẩu. Hãy bỏ mật khẩu trong PowerPoint rồi xuất lại PDF.',
        );
      }
      throw new PdfVisualError(
        'pdf_unreadable',
        'Không đọc được file PDF. Hãy kiểm tra file hoặc xuất lại từ PowerPoint.',
      );
    }

    if (doc.numPages < 1) {
      throw new PdfVisualError('pdf_no_pages', 'File PDF không có trang nào.');
    }

    const totalSlides = Math.max(1, options.slideCount);
    const usablePages = Math.min(doc.numPages, totalSlides, MAX_PAGES);
    const warnings: ParsingIssue[] = [];
    let aspectChecked = false;

    if (doc.numPages > usablePages) {
      warnings.push({
        severity: 'warning',
        code: 'pdf_pages_extra',
        message: `PDF có ${doc.numPages} trang nhưng PPTX chỉ có ${totalSlides} slide. Chỉ ${usablePages} trang đầu được dùng.`,
      });
    }
    if (doc.numPages < totalSlides) {
      warnings.push({
        severity: 'warning',
        code: 'pdf_pages_missing',
        message: `PDF chỉ có ${doc.numPages} trang cho ${totalSlides} slide. ${totalSlides - doc.numPages} slide cuối sẽ dùng bản mô phỏng từ PPTX.`,
      });
    }
    if (doc.numPages > MAX_PAGES && totalSlides > MAX_PAGES) {
      warnings.push({
        severity: 'info',
        code: 'pdf_pages_limited',
        message: `Chỉ xử lý tối đa ${MAX_PAGES} trang PDF mỗi bài để tránh đầy bộ nhớ.`,
      });
    }

    const assets: PresentationAsset[] = [];
    const pageAssetIds: string[] = [];
    let totalBytes = 0;
    let renderedPages = 0;
    let stoppedForSize = false;

    for (let pageNumber = 1; pageNumber <= usablePages; pageNumber += 1) {
      options.onProgress?.({
        value: 0.05 + (pageNumber / usablePages) * 0.9,
        message: `Đang chuyển trang PDF ${pageNumber}/${usablePages} thành ảnh slide…`,
        page: pageNumber,
        total: usablePages,
      });

      try {
        const page = await doc.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const pageAspect = baseViewport.width / Math.max(1, baseViewport.height);
        if (!aspectChecked && options.slideAspect) {
          aspectChecked = true;
          if (Math.abs(pageAspect - options.slideAspect) / options.slideAspect > ASPECT_TOLERANCE) {
            warnings.push({
              severity: 'warning',
              code: 'pdf_aspect_mismatch',
              message:
                'Tỉ lệ trang PDF khác tỉ lệ slide PPTX. Slide có thể có viền trống, nhưng nội dung vẫn đúng như bản PowerPoint.',
            });
          }
        }

        let scale = RENDER_WIDTH / Math.max(1, baseViewport.width);
        if (baseViewport.height * scale > MAX_RENDER_DIMENSION) {
          scale = MAX_RENDER_DIMENSION / Math.max(1, baseViewport.height);
        }
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Trình duyệt không tạo được canvas cho PDF.');

        // PDF pages are transparent by default; white matches PowerPoint.
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        // "print" intent renders the same page content without waiting for
        // requestAnimationFrame. A background/hidden tab throttles rAF, which
        // would otherwise leave the conversion stuck forever.
        await page.render({ canvas, viewport, intent: 'print' }).promise;

        const blob = await canvasToJpeg(canvas);
        page.cleanup();
        canvas.width = 0;
        canvas.height = 0;

        if (totalBytes + blob.size > MAX_TOTAL_BYTES) {
          stoppedForSize = true;
          warnings.push({
            severity: 'warning',
            code: 'pdf_images_budget',
            message: `Dung lượng ảnh PDF vượt ${Math.round(MAX_TOTAL_BYTES / 1024 / 1024)}MB; các trang sau không được lưu.`,
          });
          break;
        }

        const asset: PresentationAsset = {
          id: uid('slide_pdf'),
          partPath: `pdf/page-${pageNumber}.jpg`,
          mimeType: 'image/jpeg',
          size: blob.size,
          blob,
        };
        assets.push(asset);
        pageAssetIds.push(asset.id);
        totalBytes += blob.size;
        renderedPages += 1;
      } catch (error) {
        console.warn(`[Teacher Coach AI] Could not render PDF page ${pageNumber}:`, error);
        warnings.push({
          severity: 'warning',
          code: 'pdf_page_failed',
          message: `Không chuyển được trang ${pageNumber} của PDF. Slide này sẽ dùng bản mô phỏng từ PPTX.`,
        });
      }

      await yieldToUi();
    }

    if (!renderedPages) {
      throw new PdfVisualError(
        'pdf_no_pages',
        'Không chuyển được trang PDF nào thành ảnh. Hãy thử xuất PDF đơn giản hơn từ PowerPoint.',
      );
    }
    if (stoppedForSize && renderedPages < usablePages) {
      // The budget warning above already explains the partial result.
    }

    options.onProgress?.({
      value: 1,
      message: `Đã dùng ${renderedPages}/${totalSlides} trang PDF làm bản hiển thị gốc.`,
    });

    return {
      fileName: file.name,
      fileSize: file.size,
      pageCount: renderedPages,
      assets,
      pageAssetIds,
      warnings,
    };
  } finally {
    try {
      await loadingTask?.destroy();
    } catch {
      // Destroying a failed loading task is best-effort.
    }
  }
}

/**
 * Replaces the visual layer with a freshly rendered PDF, removing the previous
 * PDF images while keeping images extracted from the PPTX itself.
 */
export function applyPdfVisual(presentation: PresentationDoc, rendered: RenderedPdfVisual): PresentationDoc {
  const oldVisualIds = visualAssetIds(presentation.slides);
  const slides: PresentationSlide[] = presentation.slides.map((slide, index) => ({
    ...slide,
    visualAssetId: rendered.pageAssetIds[index],
  }));
  return {
    ...presentation,
    slides,
    assets: [
      ...presentation.assets.filter((asset) => !oldVisualIds.has(asset.id)),
      ...rendered.assets,
    ],
    visualMode: 'pdf',
    visualFileName: rendered.fileName,
    visualPageCount: rendered.pageCount,
    visualWarnings: rendered.warnings,
    updatedAt: new Date().toISOString(),
  };
}

/** Removes the PDF images and returns to the PPTX reconstruction. */
export function clearPdfVisual(presentation: PresentationDoc): PresentationDoc {
  const oldVisualIds = visualAssetIds(presentation.slides);
  const slides: PresentationSlide[] = presentation.slides.map((slide) => {
    const { visualAssetId: _visualAssetId, ...rest } = slide;
    return rest;
  });
  return {
    ...presentation,
    slides,
    assets: presentation.assets.filter((asset) => !oldVisualIds.has(asset.id)),
    visualMode: 'html',
    visualFileName: undefined,
    visualPageCount: undefined,
    visualWarnings: undefined,
    updatedAt: new Date().toISOString(),
  };
}

function visualAssetIds(slides: PresentationSlide[]): Set<string> {
  const ids = new Set<string>();
  for (const slide of slides) {
    if (slide.visualAssetId) ids.add(slide.visualAssetId);
  }
  return ids;
}
