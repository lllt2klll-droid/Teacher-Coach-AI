import type { LessonFileType, ParsingIssue } from '@/types/domain';

export interface ExtractedFile {
  text: string;
  fileType: LessonFileType;
  warnings: ParsingIssue[];
  pageCount?: number;
}

export class ExtractionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ExtractionError';
    this.code = code;
  }
}

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

interface MammothLike {
  extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{
    value: string;
    messages?: Array<{ type: string; message: string }>;
  }>;
  convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{
    value: string;
    messages?: Array<{ type: string; message: string }>;
  }>;
}

export function detectFileType(file: File): LessonFileType | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (
    name.endsWith('.docx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx';
  }
  if (name.endsWith('.txt') || file.type === 'text/plain') return 'txt';
  if (name.endsWith('.doc')) {
    throw new ExtractionError(
      'doc_legacy',
      'File .doc (Word 97-2003) chưa được hỗ trợ. Hãy lưu lại dưới dạng .docx hoặc PDF.',
    );
  }
  return null;
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

async function extractPdf(file: File): Promise<ExtractedFile> {
  const warnings: ParsingIssue[] = [];
  const [pdfjs, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  const pages: string[] = [];
  let tableLikePages = 0;

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    let pageText = '';
    let lastY: number | null = null;
    for (const rawItem of content.items) {
      if (!('str' in rawItem)) continue;
      const item = rawItem as { str: string; transform: number[]; hasEOL?: boolean };
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 4) {
        pageText += '\n';
      } else if (pageText && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
        pageText += ' ';
      }
      pageText += item.str;
      if (item.hasEOL) pageText += '\n';
      lastY = y;
    }
    if (/\s{3,}|\t/.test(pageText)) tableLikePages += 1;
    pages.push(pageText);
    page.cleanup();
  }
  const pageCount = doc.numPages;
  await loadingTask.destroy();
  const text = normalizeText(pages.join('\n\n'));

  if (text.length < Math.max(60, pageCount * 40)) {
    throw new ExtractionError(
      'pdf_scanned',
      'PDF này có thể là bản scan/ảnh nên không trích xuất được chữ. Cần OCR trước khi tải lên (ứng dụng chưa tích hợp OCR).',
    );
  }
  if (tableLikePages > 0) {
    warnings.push({
      code: 'pdf_layout',
      severity: 'warning',
      message:
        'Một số trang có bố cục dạng bảng/cột. Nội dung đã được trích xuất theo dòng nhưng thứ tự có thể cần kiểm tra lại.',
    });
  }
  return { text, fileType: 'pdf', warnings, pageCount };
}

async function extractDocx(file: File): Promise<ExtractedFile> {
  const warnings: ParsingIssue[] = [];
  const mammothModule = (await import('mammoth/mammoth.browser')) as unknown as MammothLike & {
    default?: MammothLike;
  };
  const mammoth: MammothLike = mammothModule.default ?? mammothModule;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
  const tableCount = (htmlResult.value.match(/<table/gi) || []).length;
  if (tableCount > 0) {
    warnings.push({
      code: 'docx_tables',
      severity: 'warning',
      message: `Tài liệu có ${tableCount} bảng. Nội dung bảng đã được lấy dạng văn bản nhưng có thể mất cấu trúc cột — hãy kiểm tra ở bước xác nhận.`,
    });
  }
  if (result.messages?.length) {
    warnings.push({
      code: 'docx_messages',
      severity: 'info',
      message: `Trình đọc DOCX ghi nhận ${result.messages.length} lưu ý về định dạng. Nội dung chính vẫn được trích xuất.`,
    });
  }
  const text = normalizeText(result.value);
  if (text.length < 30) {
    throw new ExtractionError('docx_empty', 'Không tìm thấy nội dung chữ trong file DOCX. File có thể bị lỗi hoặc chỉ chứa ảnh.');
  }
  return { text, fileType: 'docx', warnings };
}

export async function extractTextFromFile(file: File): Promise<ExtractedFile> {
  if (file.size === 0) {
    throw new ExtractionError('empty', 'File rỗng, không có nội dung để phân tích.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ExtractionError('too_large', 'File vượt quá 20MB. Hãy chọn file nhỏ hơn hoặc lưu bớt hình ảnh.');
  }
  const type = detectFileType(file);
  if (!type) {
    throw new ExtractionError('unsupported', 'Chỉ hỗ trợ PDF, DOCX và TXT. Hãy chuyển file sang một trong các định dạng này.');
  }
  if (type === 'pdf') return extractPdf(file);
  if (type === 'docx') return extractDocx(file);
  const text = normalizeText(await file.text());
  if (text.length < 20) {
    throw new ExtractionError('txt_empty', 'File TXT quá ngắn hoặc không có nội dung.');
  }
  return { text, fileType: 'txt', warnings: [] };
}

export async function textFromPlainInput(text: string): Promise<ExtractedFile> {
  const normalized = normalizeText(text);
  if (normalized.length < 40) {
    throw new ExtractionError('text_short', 'Nội dung quá ngắn để phân tích thành kế hoạch bài dạy.');
  }
  return { text: normalized, fileType: 'txt', warnings: [] };
}
