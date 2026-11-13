import { describe, expect, it } from 'vitest';
import type { PresentationDraft } from '@/types/domain';
import { buildPresentationContext, currentSlideIndex } from '@/services/presentation/presentation-context';
import { suggestSlideForPhase } from '@/services/presentation/slide-suggestions';
import { makePhase } from '@/test/fixtures';

function makePresentation(): PresentationDraft {
  const texts = [
    'Khởi động: chơi trò chơi truyền điện.',
    'Luyện tập: cùng làm bài tập bảng nhân 4.',
    'Củng cố: đọc lại bảng nhân và dặn dò.',
  ];
  return {
    fileName: 'bai-giang.pptx',
    fileSize: 2048,
    slideWidthEmu: 12_192_000,
    slideHeightEmu: 6_858_000,
    assets: [],
    warnings: [],
    slides: texts.map((text, index) => ({
      id: `slide_${index + 1}`,
      index,
      title: text.split(':')[0],
      text,
      background: {},
      elements: [],
    })),
  };
}

describe('buildPresentationContext', () => {
  it('sends only the current slide text plus a compact title outline', () => {
    const context = buildPresentationContext(makePresentation(), 1);
    expect(context).toEqual({
      slideNumber: 2,
      totalSlides: 3,
      title: 'Luyện tập',
      text: 'Luyện tập: cùng làm bài tập bảng nhân 4.',
      outline: ['1. Khởi động', '2. Luyện tập', '3. Củng cố'],
    });
  });

  it('clamps invalid indexes and returns null without slides', () => {
    expect(currentSlideIndex(3, -5)).toBe(0);
    expect(currentSlideIndex(3, 99)).toBe(2);
    expect(currentSlideIndex(0, 4)).toBe(0);
    expect(buildPresentationContext(null, 0)).toBeNull();
    expect(buildPresentationContext({ slides: [] }, 0)).toBeNull();
    expect(buildPresentationContext(makePresentation(), 99)?.slideNumber).toBe(3);
  });
});

describe('suggestSlideForPhase', () => {
  it('finds the slide that matches the current lesson activity', () => {
    const suggestion = suggestSlideForPhase(
      makePresentation(),
      makePhase({ name: 'Luyện tập', type: 'practice' }),
    );
    expect(suggestion?.index).toBe(1);
    expect(suggestion?.score).toBeGreaterThanOrEqual(3);
  });

  it('returns null instead of inventing a suggestion without a grounded match', () => {
    const suggestion = suggestSlideForPhase(
      makePresentation(),
      makePhase({ name: 'Hoạt động âm nhạc', type: 'knowledge' }),
    );
    expect(suggestion).toBeNull();
  });

  it('returns null when there is no presentation or phase', () => {
    expect(suggestSlideForPhase(null, makePhase())).toBeNull();
    expect(suggestSlideForPhase(makePresentation(), null)).toBeNull();
  });
});
