import type { LessonPhase, LessonPhaseType, PresentationDoc, PresentationDraft } from '@/types/domain';
import { foldVietnamese } from '@/services/nlp/vietnamese';

type PresentationLike = Pick<PresentationDoc | PresentationDraft, 'slides'>;

export interface SlideSuggestion {
  index: number;
  score: number;
  reason: string;
}

const PHASE_KEYWORDS: Record<LessonPhaseType, string[]> = {
  warmup: ['khoi dong', 'tro choi', 'on tap', 'kiem tra bai cu', 'hoi bai cu', 'khoi dong dau gio'],
  exploration: ['kham pha', 'quan sat', 'thao luan', 'du doan', 'trai nghiem', 'nhan xet'],
  knowledge: ['hinh thanh kien thuc', 'bai moi', 'vi du', 'khai niem', 'quy tac', 'cong thuc', 'noi dung bai'],
  practice: ['luyen tap', 'thuc hanh', 'bai tap', 'on luyen', 'giai bai', 'lam bai'],
  application: ['van dung', 'lien he thuc te', 'thuc te', 'ung dung', 'mo rong'],
  consolidation: ['cung co', 'tong ket', 'ghi nho', 'dan do', 'bai hoc hom nay', 'ket thuc bai'],
  other: ['hoat dong', 'noi dung', 'bai hoc', 'slide'],
};

const GENERIC_PHASE_WORDS = new Set([
  'hoat',
  'dong',
  'bai',
  'phan',
  'muc',
  'giai',
  'doan',
  'buoc',
  'noi',
  'dung',
  'cho',
  'hoc',
  'sinh',
  'giao',
  'vien',
]);

function meaningfulTokens(value: string): string[] {
  return foldVietnamese(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !GENERIC_PHASE_WORDS.has(token));
}

function scoreSlide(slideText: string, slideTitle: string, phase: LessonPhase): number {
  const title = foldVietnamese(slideTitle);
  const text = foldVietnamese(slideText);
  const keywords = PHASE_KEYWORDS[phase.type];
  let score = 0;

  for (const keyword of keywords) {
    if (title.includes(keyword)) score += 5;
    else if (text.includes(keyword)) score += 2;
  }

  for (const token of meaningfulTokens(phase.name)) {
    if (title.includes(token)) score += 3;
    else if (text.includes(token)) score += 1;
  }

  const fullPhaseName = foldVietnamese(phase.name).trim();
  if (fullPhaseName.length >= 5 && title.includes(fullPhaseName)) score += 5;
  if (fullPhaseName.length >= 5 && text.includes(fullPhaseName)) score += 2;

  return score;
}

/**
 * Suggests a slide for the current lesson phase using real slide titles/text.
 * Returns null when no slide has a convincing match, so the UI never invents a
 * recommendation that is not grounded in the uploaded presentation.
 */
export function suggestSlideForPhase(
  presentation: PresentationLike | null | undefined,
  phase: LessonPhase | null | undefined,
): SlideSuggestion | null {
  const slides = presentation?.slides;
  if (!slides?.length || !phase) return null;

  let best: SlideSuggestion | null = null;
  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    const score = scoreSlide(slide.text, slide.title, phase);
    if (!best || score > best.score) {
      best = {
        index,
        score,
        reason: `Gợi ý cho hoạt động “${phase.name}”`,
      };
    }
  }

  if (!best || best.score < 3) return null;
  return best;
}
