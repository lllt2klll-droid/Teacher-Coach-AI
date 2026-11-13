import type { PresentationContext, PresentationDoc, PresentationDraft } from '@/types/domain';

const MAX_SLIDE_TEXT_CHARS = 1_600;
const MAX_OUTLINE_SLIDES = 80;

type PresentationLike = Pick<PresentationDoc | PresentationDraft, 'slides'>;

/**
 * Compact, deterministic context for AI students: only the slide currently on
 * screen plus a short title outline. Full slide text is intentionally not sent
 * so the prompt stays small and focused.
 */
export function buildPresentationContext(
  presentation: PresentationLike | null | undefined,
  index: number,
): PresentationContext | null {
  const slides = presentation?.slides;
  if (!slides?.length) return null;
  const safeIndex = Math.max(0, Math.min(slides.length - 1, Number.isFinite(index) ? Math.round(index) : 0));
  const slide = slides[safeIndex];
  const text = slide.text.replace(/\s+/g, ' ').trim().slice(0, MAX_SLIDE_TEXT_CHARS);
  const outline = slides
    .slice(0, MAX_OUTLINE_SLIDES)
    .map((item, itemIndex) => `${itemIndex + 1}. ${item.title || `Slide ${itemIndex + 1}`}`);
  return {
    slideNumber: safeIndex + 1,
    totalSlides: slides.length,
    title: slide.title || `Slide ${safeIndex + 1}`,
    text,
    outline,
  };
}

export function currentSlideIndex(totalSlides: number, index: number): number {
  if (totalSlides <= 0) return 0;
  return Math.max(0, Math.min(totalSlides - 1, Math.round(index)));
}
