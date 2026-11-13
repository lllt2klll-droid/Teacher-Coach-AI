import { describe, expect, it } from 'vitest';
import type { PresentationAsset, PresentationDoc } from '@/types/domain';
import {
  applyPdfVisual,
  clearPdfVisual,
  type RenderedPdfVisual,
} from '@/services/presentation/pdf-visual';

function makeAsset(id: string, partPath: string): PresentationAsset {
  return {
    id,
    partPath,
    mimeType: partPath.startsWith('pdf/') ? 'image/jpeg' : 'image/png',
    size: 32,
    blob: new Blob(['x'], { type: partPath.startsWith('pdf/') ? 'image/jpeg' : 'image/png' }),
  };
}

function makePresentation(overrides: Partial<PresentationDoc> = {}): PresentationDoc {
  return {
    id: 'presentation_1',
    lessonPlanId: 'lesson_1',
    fileName: 'bai-giang.pptx',
    fileSize: 2048,
    slideWidthEmu: 12_192_000,
    slideHeightEmu: 6_858_000,
    slides: [
      {
        id: 'slide_1',
        index: 0,
        title: 'Khởi động',
        text: 'Khởi động: chơi trò chơi truyền điện.',
        background: {},
        elements: [],
      },
      {
        id: 'slide_2',
        index: 1,
        title: 'Luyện tập',
        text: 'Luyện tập: cùng làm bài tập bảng nhân 4.',
        background: {},
        elements: [],
      },
      {
        id: 'slide_3',
        index: 2,
        title: 'Củng cố',
        text: 'Củng cố: đọc lại bảng nhân và dặn dò.',
        background: {},
        elements: [],
      },
    ],
    assets: [makeAsset('asset_pptx_1', 'ppt/media/image1.png')],
    warnings: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRendered(pageCount: number, prefix = 'pdf_new'): RenderedPdfVisual {
  const assets = Array.from({ length: pageCount }, (_, index) =>
    makeAsset(`${prefix}_${index + 1}`, `pdf/page-${index + 1}.jpg`),
  );
  return {
    fileName: 'bai-giang.pdf',
    fileSize: 4096,
    pageCount,
    assets,
    pageAssetIds: assets.map((asset) => asset.id),
    warnings: [],
  };
}

describe('applyPdfVisual', () => {
  it('attaches a page image to each slide without changing the PPTX text used by AI', () => {
    const presentation = makePresentation();
    const result = applyPdfVisual(presentation, makeRendered(3));

    expect(result.slides.map((slide) => slide.visualAssetId)).toEqual([
      'pdf_new_1',
      'pdf_new_2',
      'pdf_new_3',
    ]);
    expect(result.slides.map((slide) => slide.text)).toEqual(
      presentation.slides.map((slide) => slide.text),
    );
    expect(result.visualMode).toBe('pdf');
    expect(result.visualFileName).toBe('bai-giang.pdf');
    expect(result.visualPageCount).toBe(3);
    expect(result.assets.map((asset) => asset.id)).toEqual([
      'asset_pptx_1',
      'pdf_new_1',
      'pdf_new_2',
      'pdf_new_3',
    ]);
  });

  it('keeps trailing slides on the PPTX renderer when the PDF has fewer pages', () => {
    const result = applyPdfVisual(makePresentation(), makeRendered(2));

    expect(result.slides[0].visualAssetId).toBe('pdf_new_1');
    expect(result.slides[1].visualAssetId).toBe('pdf_new_2');
    expect(result.slides[2].visualAssetId).toBeUndefined();
    expect(result.visualPageCount).toBe(2);
  });

  it('drops the previous PDF assets when replacing the visual layer', () => {
    const withOldPdf = applyPdfVisual(makePresentation(), makeRendered(3, 'pdf_old'));
    const replaced = applyPdfVisual(withOldPdf, makeRendered(3, 'pdf_new'));

    expect(replaced.assets.some((asset) => asset.id.startsWith('pdf_old'))).toBe(false);
    expect(replaced.assets.some((asset) => asset.id === 'asset_pptx_1')).toBe(true);
    expect(replaced.slides.map((slide) => slide.visualAssetId)).toEqual([
      'pdf_new_1',
      'pdf_new_2',
      'pdf_new_3',
    ]);
  });

  it('stores PDF warnings separately from PPTX parsing warnings', () => {
    const rendered = makeRendered(3);
    rendered.warnings = [
      { severity: 'warning', code: 'pdf_pages_extra', message: 'PDF có nhiều trang hơn PPTX.' },
    ];
    const result = applyPdfVisual(makePresentation(), rendered);

    expect(result.warnings).toEqual([]);
    expect(result.visualWarnings).toEqual(rendered.warnings);
  });
});

describe('clearPdfVisual', () => {
  it('removes page images and returns to the PPTX reconstruction', () => {
    const withPdf = applyPdfVisual(makePresentation(), makeRendered(3));
    const cleared = clearPdfVisual(withPdf);

    expect(cleared.slides.every((slide) => slide.visualAssetId === undefined)).toBe(true);
    expect(cleared.slides.map((slide) => slide.text)).toEqual(
      withPdf.slides.map((slide) => slide.text),
    );
    expect(cleared.assets.map((asset) => asset.id)).toEqual(['asset_pptx_1']);
    expect(cleared.visualMode).toBe('html');
    expect(cleared.visualFileName).toBeUndefined();
    expect(cleared.visualPageCount).toBeUndefined();
    expect(cleared.visualWarnings).toBeUndefined();
  });

  it('is a safe no-op when no PDF was attached', () => {
    const presentation = makePresentation();
    const cleared = clearPdfVisual(presentation);

    expect(cleared.slides.every((slide) => slide.visualAssetId === undefined)).toBe(true);
    expect(cleared.assets).toEqual(presentation.assets);
    expect(cleared.visualMode).toBe('html');
  });
});
