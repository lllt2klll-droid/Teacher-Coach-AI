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
  // When a PDF visual layer is attached, the PDF page text is what the class
  // can actually see. Fall back to the PPTX text for image-only pages or when
  // no PDF is attached.
  const visualText = slide.visualText?.trim();
  const visibleText = visualText || slide.text;
  const text = visibleText.replace(/\s+/g, ' ').trim().slice(0, MAX_SLIDE_TEXT_CHARS);
  const firstLine = visibleText
    .split(/\n|(?<=[.!?…])\s+/u)
    .map((line) => line.trim())
    .find((line) => line.length >= 3);
  // The PDF page is the source of truth for what is on screen, including the
  // title a teacher may ask a student to read out loud. Strip a terminal period
  // because slide titles are spoken inside a sentence.
  const visibleTitle = firstLine?.replace(/[.:;,]+$/u, '').trim();
  const title =
    (visualText ? visibleTitle : slide.title?.trim()) ||
    slide.title?.trim() ||
    visibleTitle ||
    `Slide ${safeIndex + 1}`;
  const outline = slides
    .slice(0, MAX_OUTLINE_SLIDES)
    .map((item, itemIndex) => `${itemIndex + 1}. ${item.title || `Slide ${itemIndex + 1}`}`);
  return {
    slideNumber: safeIndex + 1,
    totalSlides: slides.length,
    title,
    text,
    outline,
  };
}

export function currentSlideIndex(totalSlides: number, index: number): number {
  if (totalSlides <= 0) return 0;
  return Math.max(0, Math.min(totalSlides - 1, Math.round(index)));
}
