export function foldVietnamese(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

const STOPWORDS = new Set(
  [
    'la', 'va', 'cua', 'co', 'cho', 'voi', 'thi', 'ma', 'nhu', 'de', 'trong', 'mot', 'cac', 'nhung',
    'em', 'cac em', 'chung ta', 'minh', 'toi', 'co giao', 'thay', 'giao vien', 'hoc sinh', 'ban',
    'nay', 'do', 'a', 'nhe', 'nhi', 'vay', 'roi', 'da', 'se', 'dang', 'duoc', 'bi', 'ra', 'vao',
    'len', 'xuong', 'o', 'tai', 'vi', 'nen', 'hay', 'hoac', 'neu', 'khi', 'sau', 'truoc', 'cung',
    'rat', 'qua', 'hon', 'nhat', 'moi', 'chiec', 'cai', 'con', 'so', 'bang', 'bao nhieu', 'gi',
    'nao', 'the', 'sao', 'khong', 'phai', 'dung', 'ha', 'oi', 'nha', 'di', 'nao',
  ].map(foldVietnamese),
);

export function tokenize(text: string, keepStopwords = false): string[] {
  const folded = foldVietnamese(text);
  const raw = folded.split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
  return keepStopwords ? raw : raw.filter((token) => !STOPWORDS.has(token));
}

export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  return intersection / (setA.size + setB.size - intersection);
}

const phrasePatternCache = new Map<string, RegExp>();

function phrasePattern(phrase: string): RegExp {
  const key = foldVietnamese(phrase);
  const cached = phrasePatternCache.get(key);
  if (cached) return cached;
  const escaped = key
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  const pattern = new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`);
  phrasePatternCache.set(key, pattern);
  return pattern;
}

export function textContainsAny(text: string, phrases: string[]): boolean {
  const folded = foldVietnamese(text);
  // Whole-word matching: "hay qua" must not match "hãy quan sát", and "ai"
  // must not match "bài". Substring matching silently inflated praise and
  // question counts.
  return phrases.some((phrase) => phrasePattern(phrase).test(folded));
}

const QUESTION_AUX = [
  'nao', 'gi', 'sao', 'vi sao', 'tai sao', 'bao nhieu', 'the nao', 'o dau', 'ai', 'khi nao',
  'nhu the nao', 'dung khong', 'co phai', 'hay khong', 'chua', 'giup gi', 'lam gi',
];

export type QuestionKind = 'open' | 'closed' | 'probe' | 'check' | 'application';

export interface QuestionClassification {
  isQuestion: boolean;
  kind: QuestionKind;
  confidence: number;
  openEnded: boolean;
}

export function classifyQuestion(text: string): QuestionClassification {
  const folded = foldVietnamese(text);
  const hasQuestionMark = /\?/.test(text);
  const imperativeQuestion = /(hay|em hay|ban hay|cac em hay)\s+(neu|cho biet|ke|giai thich|trinh bay|so sanh|tim|tinh)/.test(folded);
  const hasAux = textContainsAny(text, QUESTION_AUX);
  const isQuestion = hasQuestionMark || hasAux || imperativeQuestion;
  if (!isQuestion) {
    return { isQuestion: false, kind: 'closed', confidence: 0.7, openEnded: false };
  }
  let kind: QuestionKind = 'closed';
  let confidence = 0.68;
  if (/(vi sao|tai sao|giai thich|vi sao lai|theo em|theo con|em nghi|con nghi|neu cach|trinh bay|so sanh|nhan xet|ke lai|vi du)/.test(folded)) {
    kind = 'probe';
    confidence = 0.78;
  } else if (/(vi du|thuc te|trong cuoc song|ung dung|van dung|lieu|co the ap dung)/.test(folded)) {
    kind = 'application';
    confidence = 0.72;
  } else if (/(the nao|nhu the nao|o dau|khi nao|ke|neu|trinh bay|theo em|theo con)/.test(folded)) {
    kind = 'open';
    confidence = 0.74;
  } else if (/(bao nhieu|bang may|dung hay sai|co phai|dung khong|hay khong|nho lai|nhac lai|la gi|goi ten)/.test(folded)) {
    kind = 'check';
    confidence = 0.76;
  }
  const openEnded = kind === 'open' || kind === 'probe' || kind === 'application';
  if (/\b(vi sao|tai sao)\b/.test(folded)) {
    kind = 'probe';
    confidence = Math.max(confidence, 0.82);
  }
  return { isQuestion, kind, confidence, openEnded };
}

export function detectPraise(text: string): boolean {
  return textContainsAny(text, [
    'gioi', 'gioi lam', 'tot lam', 'dung roi', 'chinh xac', 'hay qua', 'tuyet voi', 'xuat sac',
    'khen', 'cam on em', 'rat tot', 'dung la', 'thong minh', 'co gang tot',
  ]);
}

export function detectEncouragement(text: string): boolean {
  return textContainsAny(text, [
    'co len', 'thu lai', 'khong sao', 'dung lo', 'cung suy nghi', 'dong vien', 'tin la',
    'em nao', 'thu nghi', 'ban nao', 'cach khac', 'kiem tra lai', 'dung voi', 'chua dung',
  ]);
}

export function detectGreeting(text: string): boolean {
  return textContainsAny(text, ['chao', 'xin chao', 'chao ca lop', 'chao cac em', 'chung ta bat dau', 'hom nay chung ta']);
}

export function detectTransition(text: string): boolean {
  return textContainsAny(text, [
    'chuyen sang', 'tiep theo', 'bay gio chung ta', 'sang hoat dong', 'sang bai', 'chung ta cung chuyen',
    'hoat dong tiep', 'phan tiep', 'ket thuc hoat dong', 'da xong', 'chung ta se hoc', 'buoc sang',
  ]);
}

export function detectSummary(text: string): boolean {
  return textContainsAny(text, ['tong ket', 'cung co', 'nhac lai', 'hom nay hoc duoc', 'bai hoc hom nay', 'dan do']);
}

export interface TeacherIntentResult {
  intent:
    | 'greeting'
    | 'question'
    | 'call_student'
    | 'instruction'
    | 'group_work'
    | 'praise'
    | 'scold'
    | 'transition'
    | 'explanation'
    | 'check_understanding'
    | 'wait_time'
    | 'exercise'
    | 'dismissal'
    | 'smalltalk'
    | 'unknown';
  question?: QuestionClassification;
  calledStudentName?: string;
  confidence: number;
}

export function detectTeacherIntent(text: string, studentNames: string[] = []): TeacherIntentResult {
  const trimmed = text.trim();
  if (!trimmed) return { intent: 'unknown', confidence: 0.2 };
  const folded = foldVietnamese(trimmed);
  const question = classifyQuestion(trimmed);

  const matchedName = [...studentNames]
    .sort((a, b) => b.length - a.length)
    .find((name) => {
      const foldedName = foldVietnamese(name);
      return folded.includes(foldedName) || (foldedName.split(' ').length > 1 && folded.includes(foldedName.split(' ').slice(-2).join(' ')));
    });

  if (/(het gio|ket thuc buoi|chung ta dung lai|tam biet|chao tam biet)/.test(folded)) {
    return { intent: 'dismissal', confidence: 0.82 };
  }
  if (detectGreeting(trimmed) && !question.isQuestion) {
    return { intent: 'greeting', confidence: 0.8 };
  }
  if (matchedName && /(moi|goi|ban|em|con)\b/.test(folded) && !/^(.{0,12})?moi ca lop/.test(folded)) {
    return { intent: 'call_student', calledStudentName: matchedName, confidence: 0.86, question };
  }
  if (matchedName && question.isQuestion) {
    return { intent: 'question', calledStudentName: matchedName, question, confidence: 0.84 };
  }
  if (detectTransition(trimmed)) {
    return { intent: 'transition', confidence: 0.8, question };
  }
  if (/(nhom doi|nhom 4|nhom bon|thao luan nhom|lam viec nhom|theo nhom|hoat dong nhom)/.test(folded)) {
    return { intent: 'group_work', confidence: 0.85 };
  }
  if (/(lay bang con|lay vo|mo sach|dong sach|quan sat|ghi vao|viet vao|to mau|cat|dan|do dac|ve|doc|keo|chon|dat|sap xep)/.test(folded) && !question.isQuestion) {
    return { intent: 'instruction', confidence: 0.72 };
  }
  if (/(lam bai|bai tap|hoan thanh bai|giai bai|bai so)/.test(folded) && !question.isQuestion) {
    return { intent: 'exercise', confidence: 0.78 };
  }
  if (question.isQuestion) {
    if (/(dung khong|dung roi phai khong|da hieu chua|cac em hieu|con ban nao chua ro|co em nao chua hieu)/.test(folded)) {
      return { intent: 'check_understanding', question, confidence: 0.78 };
    }
    return { intent: 'question', question, confidence: question.confidence };
  }
  if (detectPraise(trimmed)) {
    return { intent: 'praise', confidence: 0.76 };
  }
  if (/(thoi|khong duoc|chua ngoan|mat trat tu|dung noi chuyen|tap trung)/.test(folded)) {
    return { intent: 'scold', confidence: 0.6 };
  }
  if (/(suy nghi|cho cac em|thoi gian|chua tra loi|doi mot chut)/.test(folded)) {
    return { intent: 'wait_time', confidence: 0.62 };
  }
  if (/(nghia la|co nghia|vi du|giai thich|nhu vay|tuc la|boi vi|do do)/.test(folded)) {
    return { intent: 'explanation', confidence: 0.62 };
  }
  if (trimmed.split(/\s+/).length <= 6) {
    return { intent: 'smalltalk', confidence: 0.4 };
  }
  return { intent: 'unknown', confidence: 0.35 };
}

/** Extracts a simple numeric arithmetic result from Vietnamese/expression text. */
export function tryArithmeticAnswer(text: string): { value: number; expression: string } | null {
  const normalized = foldVietnamese(text).replace(/,/g, '.');
  const direct = normalized.match(/(\d+(?:\.\d+)?)\s*(nhan|x|\*|cong|\+|tru|-|chia|:)\s*(\d+(?:\.\d+)?)/);
  if (!direct) return null;
  const left = Number(direct[1]);
  const right = Number(direct[3]);
  const op = direct[2];
  let value: number | null = null;
  if (['nhan', 'x', '*'].includes(op)) value = left * right;
  if (['cong', '+'].includes(op)) value = left + right;
  if (['tru', '-'].includes(op)) value = left - right;
  if (['chia', ':'].includes(op) && right !== 0) value = left / right;
  if (value === null || !Number.isFinite(value)) return null;
  return { value, expression: `${left} ${op} ${right}` };
}

export function extractNumbers(text: string): number[] {
  return Array.from(text.matchAll(/-?\d+(?:[.,]\d+)?/g))
    .map((match) => Number(match[0].replace(',', '.')))
    .filter((value) => Number.isFinite(value));
}

export function shorten(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
