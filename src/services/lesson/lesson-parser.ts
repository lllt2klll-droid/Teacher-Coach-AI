import { uid } from '@/lib/utils';
import type {
  LessonExercise,
  LessonFileType,
  LessonObjective,
  LessonPhase,
  LessonPhaseType,
  LessonPlan,
  ParsingIssue,
} from '@/types/domain';

interface ParseMeta {
  fileName: string;
  fileType: LessonFileType;
  fileSize: number;
}

interface Section {
  code: string;
  title: string;
  lines: string[];
}

const PHASE_KEYWORDS: Array<{ type: LessonPhaseType; patterns: RegExp[] }> = [
  { type: 'warmup', patterns: [/khởi động/i, /ổn định/i, /trò chơi/i, /warm.?up/i] },
  { type: 'exploration', patterns: [/khám phá/i, /trải nghiệm/i, /quan sát/i] },
  { type: 'knowledge', patterns: [/hình thành kiến thức/i, /kiến thức mới/i, /dạy bài mới/i, /nhận biết/i] },
  { type: 'practice', patterns: [/luyện tập/i, /thực hành/i, /rèn luyện/i] },
  { type: 'application', patterns: [/vận dụng/i, /ứng dụng/i, /liên hệ/i] },
  { type: 'consolidation', patterns: [/củng cố/i, /tổng kết/i, /dặn dò/i, /ôn tập/i] },
];

const SUBJECT_KEYWORDS: Record<string, string[]> = {
  Toán: ['toán', 'phép cộng', 'phép trừ', 'phép nhân', 'phép chia', 'số học', 'hình học', 'đo lường', 'bảng nhân'],
  'Tiếng Việt': ['tiếng việt', 'tập đọc', 'chính tả', 'luyện từ', 'tập làm văn', 'kể chuyện', 'ngữ pháp', 'từ chỉ'],
  'Tự nhiên và Xã hội': ['tự nhiên và xã hội', 'tự nhiên', 'cây', 'động vật', 'thời tiết', 'cơ thể', 'gia đình'],
  'Đạo đức': ['đạo đức', 'ứng xử', 'lễ phép', 'biết ơn', 'trung thực', 'tôn trọng'],
  'Âm nhạc': ['âm nhạc', 'hát', 'nhạc', 'tiết tấu', 'bài hát'],
  'Mĩ thuật': ['mĩ thuật', 'vẽ', 'màu sắc', 'tạo hình', 'nặn'],
  'Giáo dục thể chất': ['thể chất', 'vận động', 'bài tập thể dục', 'bật nhảy', 'chạy'],
  'Tin học': ['tin học', 'máy tính', 'bàn phím', 'chuột', 'phần mềm'],
  'Tiếng Anh': ['tiếng anh', 'english', 'vocabulary', 'phonics'],
  'Hoạt động trải nghiệm': ['trải nghiệm', 'hoạt động nhóm', 'sinh hoạt lớp', 'tổ chức sự kiện'],
};

function cleanLine(line: string): string {
  return line
    .replace(/^[\s\-–—•*+]+/, '')
    .replace(/^\d{1,2}[.)]\s*/, '')
    .replace(/^[a-zđ][.)]\s+/i, '')
    .trim();
}

function meaningful(line: string): boolean {
  const cleaned = cleanLine(line);
  return cleaned.length >= 4 && !/^(trang|page)\s*\d+$/i.test(cleaned);
}

function sentenceSplit(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 4);
}

function stripHeadingPrefix(line: string): { prefix: string; rest: string } {
  const match = line.match(/^\s*((?:[IVXLC]{1,5}|\d{1,2})[.)])\s*(.*)$/i);
  if (match) return { prefix: match[1], rest: match[2].trim() };
  return { prefix: '', rest: line.trim() };
}

function matchSectionHeading(line: string): { code: string; title: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 140) return null;
  if (detectPhaseHeading(trimmed)) return null;
  const { prefix, rest } = stripHeadingPrefix(trimmed);
  const upper = rest.toUpperCase();
  const isAllCaps = /[A-ZÀ-ỸĐ]/.test(rest) && rest === upper && rest.length >= 5 && rest.length <= 100;
  if (!prefix && !isAllCaps) return null;
  // A numbered objective/content line such as
  // "1. Kiến thức: Học sinh ... ghi nhớ ..." is a sentence, not a heading.
  // Do not let a keyword inside it split the surrounding section.
  const looksLikeSentence =
    /[.!?]\s*$/.test(rest) || (rest.includes(':') && rest.length > 60) || rest.length > 100;
  if (!isAllCaps && looksLikeSentence) return null;
  const title = rest.replace(/[:\-–—]\s*$/, '').trim();
  const checks: Array<{ code: string; patterns: RegExp[] }> = [
    { code: 'objectives', patterns: [/mục tiêu/i, /mục đích/i, /yêu cầu cần đạt/i] },
    { code: 'materials', patterns: [/thiết bị/i, /đồ dùng/i, /chuẩn bị/i, /phương tiện/i] },
    { code: 'activities', patterns: [/tiến trình/i, /các hoạt động/i, /hoạt động dạy/i, /tổ chức hoạt động/i] },
    { code: 'knowledge', patterns: [/kiến thức trọng tâm/i, /nội dung bài/i, /ghi nhớ/i, /kiến thức cần/i] },
    { code: 'prerequisites', patterns: [/kiến thức đã biết/i, /kiến thức nền/i, /hiểu biết sẵn có/i] },
    { code: 'assessment', patterns: [/đánh giá/i, /tiêu chí/i, /nhận xét/i] },
    { code: 'exercises', patterns: [/bài tập/i, /luyện tập/i, /thực hành/i] },
    { code: 'expected', patterns: [/dự kiến/i, /đáp án/i, /câu trả lời/i] },
    { code: 'conclusion', patterns: [/củng cố/i, /dặn dò/i, /tổng kết/i] },
  ];
  for (const check of checks) {
    if (check.patterns.some((pattern) => pattern.test(title))) {
      return { code: check.code, title };
    }
  }
  // Only Roman numerals and ALL-CAPS headers are safe as generic sections.
  // A numbered content line such as "1. Kiến thức: Học sinh ..." must not
  // split the surrounding section into empty pieces.
  if (isAllCaps || /^[IVXLC]{1,5}[.)]$/i.test(prefix)) return { code: 'other', title };
  return null;
}

function detectPhaseHeading(line: string): { name: string; type: LessonPhaseType } | null {
  const trimmed = line.trim().replace(/^[•*\-–]\s*/, '');
  if (!trimmed || trimmed.length > 160) return null;
  const direct = trimmed.match(/^(?:hoạt động|hđ|giai đoạn)\s*(\d{1,2})\s*[:.\-–]?\s*(.*)$/i);
  const numbered = trimmed.match(/^(?:[IVXLC]{1,5}|\d{1,2})[.)]\s*(hoạt động|khởi động|khám phá|hình thành|kiến thức mới|luyện tập|vận dụng|củng cố|ôn tập|tìm hiểu|trò chơi)(.*)$/i);
  let name = '';
  if (direct) {
    name = direct[2]?.trim() || '';
    if (!name) {
      const candidate = trimmed.replace(/^(?:hoạt động|hđ|giai đoạn)\s*\d{1,2}\s*[:.\-–]?\s*/i, '');
      name = candidate || `Hoạt động ${direct[1]}`;
    }
  } else if (numbered) {
    name = `${numbered[1]}${numbered[2] ?? ''}`.trim();
  } else {
    const phaseOnly = trimmed.match(
      /^(khởi động|khám phá|hình thành kiến thức(?:\s+mới)?|luyện tập|thực hành|vận dụng|củng cố|ôn tập)\b(?:\s*[:.\-–]\s*(.*))?$/i,
    );
    if (!phaseOnly) return null;
    name = phaseOnly[1] + (phaseOnly[2] ? ` – ${phaseOnly[2]}` : '');
  }
  name = name.replace(/[:\-–—]\s*$/, '').trim();
  let type: LessonPhaseType = 'other';
  for (const entry of PHASE_KEYWORDS) {
    if (entry.patterns.some((pattern) => pattern.test(trimmed))) {
      type = entry.type;
      break;
    }
  }
  if (type === 'other' && !name) return null;
  return { name: name || 'Hoạt động', type };
}

function collectSections(text: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of text.split('\n')) {
    const heading = matchSectionHeading(line);
    if (heading) {
      current = { code: heading.code, title: heading.title, lines: [] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  return sections;
}

function sectionText(sections: Section[], codes: string[]): string {
  return sections
    .filter((section) => codes.includes(section.code))
    .map((section) => section.lines.join('\n'))
    .join('\n');
}

function parseBullets(lines: string[], limit = 12): string[] {
  const items: string[] = [];
  let buffer = '';
  const flush = () => {
    const value = buffer.trim();
    if (value.length >= 6) items.push(value);
    buffer = '';
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const startsBullet = /^[\s\-–—•*+]|^\d{1,2}[.)]\s|^[a-zđ][.)]\s+/i.test(raw);
    if (startsBullet) {
      flush();
      buffer = cleanLine(line);
    } else if (buffer) {
      buffer = `${buffer} ${line}`;
    } else if (meaningful(line)) {
      buffer = line;
    }
  }
  flush();
  const unique = Array.from(new Set(items.map((item) => item.replace(/\s+/g, ' '))));
  return unique.slice(0, limit);
}

function extractGrade(text: string): number {
  const match = text.match(/\b(?:lớp|khối)\s*([1-5])\b/i);
  if (!match) return 0;
  return Number(match[1]);
}

function detectSubject(text: string): string {
  const normalized = text.toLowerCase();
  let best = '';
  let bestScore = 0;
  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      const matches = normalized.split(keyword).length - 1;
      score += Math.min(4, matches);
    }
    if (score > bestScore) {
      best = subject;
      bestScore = score;
    }
  }
  return bestScore >= 2 ? best : '';
}

function extractTitle(text: string, fileName: string): { title: string; topic: string } {
  const lines = text.split('\n').slice(0, 40).map((line) => line.trim()).filter(Boolean);
  const named = lines.find(
    (line) =>
      /^\s*(?:tên\s+bài(?:\s+dạy)?|bài\s+dạy|chủ\s+đề)\s*[:.\-–]/i.test(line) &&
      line.length < 160 &&
      !/^kế hoạch/i.test(line),
  );
  const explicit = lines.find(
    (line) => /^\s*bài\s*\d+\s*[:.\-–]/i.test(line) && line.length <= 140,
  );
  const candidates = [explicit, named, ...lines.filter((line) => /^bài\s*\d+/i.test(line))].filter(
    (line): line is string => Boolean(line),
  );
  let raw = candidates[0] ?? '';
  if (raw && /^\s*(?:tên\s+bài(?:\s+dạy)?|bài\s+dạy|chủ\s+đề)\s*[:.\-–]/i.test(raw)) {
    raw = raw.replace(/^\s*(?:tên\s+bài(?:\s+dạy)?|bài\s+dạy|chủ\s+đề)\s*[:.\-–]?\s*/i, '').trim();
  }
  if (!raw) {
    const uppercase = lines.find(
      (line) =>
        line.length >= 6 &&
        line.length <= 110 &&
        line === line.toUpperCase() &&
        !/KẾ HOẠCH|GIÁO ÁN|TRƯỜNG|SINH VIÊN|GIÁO VIÊN|LỚP|MÔN|MỤC TIÊU|YÊU CẦU/i.test(line),
    );
    raw = uppercase ?? '';
  }
  if (!raw) {
    raw = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  }
  const title = raw.replace(/\s+/g, ' ').trim() || 'Kế hoạch bài dạy';
  const topic = title.replace(/^(bài|chủ đề)\s*\d*\s*[:.\-–]\s*/i, '').trim();
  return { title, topic: topic || title };
}

function detectDuration(block: string): number {
  const matches = Array.from(block.matchAll(/(\d{1,3})\s*(?:phút|phut|mins?|')/gi));
  if (!matches.length) return 0;
  const values = matches
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 180);
  return values.length ? Math.max(...values) : 0;
}

function extractLabelled(block: string, label: RegExp): string[] {
  const results: string[] = [];
  const lines = block.split('\n');
  lines.forEach((line, index) => {
    const match = line.match(label);
    if (!match) return;
    let content = (match[1] ?? '').trim();
    if (!content) {
      content = lines
        .slice(index + 1, index + 3)
        .map((next) => next.trim())
        .filter(Boolean)
        .join(' ');
    }
    if (content.length >= 3) results.push(content);
  });
  return Array.from(new Set(results)).slice(0, 10);
}

function cleanQuestion(raw: string): string {
  return raw
    .replace(/^[-–—•*+\d.)\s:]+/, '')
    .replace(/^(?:GV|Giáo viên|Gv|giáo viên)\s*(?:nêu câu hỏi|đặt câu hỏi|hỏi)\s*[:：]?\s*/i, '')
    .replace(/^(?:Câu hỏi|Hỏi)\s*[:：]\s*/i, '')
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
    .trim();
}

function extractQuestions(block: string): string[] {
  const questions: string[] = [];
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/\?/.test(trimmed)) {
      for (const sentence of sentenceSplit(trimmed)) {
        if (/\?/.test(sentence)) {
          const value = cleanQuestion(sentence);
          if (value.length >= 8 && value.length <= 300) questions.push(value);
        }
      }
    } else if (/^(câu hỏi|gv hỏi|giáo viên hỏi|hỏi)\s*[:：]/i.test(trimmed)) {
      const value = cleanQuestion(
        trimmed.replace(/^(câu hỏi|gv hỏi|giáo viên hỏi|hỏi)\s*[:：]\s*/i, '').trim(),
      );
      if (value.length >= 6) questions.push(value);
    }
  }
  return Array.from(new Set(questions)).slice(0, 10);
}

function extractExpected(block: string, questionLines: string[]): string[] {
  const labelled = extractLabelled(
    block,
    /^(?:[-–•*]\s*)?(?:dự kiến(?:\s+(?:câu trả lời|câu trả lời của hs))?|đáp án|trả lời|hs trả lời|học sinh trả lời)\s*[:：\-–]\s*(.+)$/i,
  );
  if (labelled.length) return labelled;
  const responses: string[] = [];
  for (const line of block.split('\n')) {
    const match = line.match(/^(?:[-–•*]\s*)?(?:HS|Học sinh|Hs)\s*[:：\-–]\s*(.+)$/i);
    if (match) {
      const value = match[1].trim();
      if (value.length >= 2 && !/^(làm|thực hiện|quan sát|theo dõi|ghi|đọc|cả lớp)/i.test(value)) {
        responses.push(value);
      }
    }
  }
  if (!responses.length) {
    for (const question of questionLines) {
      const inline = question.match(/^(.{5,}?)\s*(?:=>|→|->)\s*(.+)$/);
      if (inline) responses.push(inline[2].trim());
    }
  }
  return Array.from(new Set(responses)).slice(0, 10);
}

function extractQuestionsAndAnswers(text: string) {
  const lines = text.split('\n');
  const qa: Array<{ question: string; answer: string }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!/\?/.test(line) || line.length < 10) continue;
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j += 1) {
      const next = lines[j].trim();
      if (!next) continue;
      const answer = next.match(/^(?:[-–•*]\s*)?(?:dự kiến|đáp án|trả lời|hs|học sinh)\s*[:：\-–]\s*(.+)$/i);
      if (answer) {
        qa.push({ question: line, answer: answer[1].trim() });
        break;
      }
    }
  }
  return qa;
}

function phaseBlocks(text: string): Array<{ heading: string; type: LessonPhaseType; block: string; startLine: number }> {
  const lines = text.split('\n');
  const headings: Array<{ index: number; heading: string; type: LessonPhaseType }> = [];
  lines.forEach((line, index) => {
    const heading = detectPhaseHeading(line);
    if (heading) headings.push({ index, heading: heading.name, type: heading.type });
  });
  if (!headings.length) return [];
  return headings.map((entry, index) => {
    const next = headings[index + 1]?.index ?? lines.length;
    return {
      heading: entry.heading,
      type: entry.type,
      block: lines.slice(entry.index + 1, next).join('\n'),
      startLine: entry.index,
    };
  });
}

function isPhaseNamedLowConfidence(name: string): boolean {
  return /hoạt động\s*\d+$/i.test(name) && name.length < 16;
}

function extractRoleActions(block: string, role: 'teacher' | 'student'): string[] {
  const pattern =
    role === 'teacher'
      ? /^(?:GV|Giáo viên)\b\s*[:：\-–]?\s*/i
      : /^(?:HS|Học sinh)\b\s*[:：\-–]?\s*/i;
  const actions: string[] = [];
  for (const raw of block.split('\n')) {
    const line = cleanLine(raw);
    if (!pattern.test(line)) continue;
    const value = line.replace(pattern, '').trim();
    if (value.length >= 6) actions.push(value);
  }
  return Array.from(new Set(actions)).slice(0, 10);
}

function buildPhases(text: string, materials: string[], warnings: ParsingIssue[]): LessonPhase[] {
  const blocks = phaseBlocks(text);
  if (!blocks.length) {
    warnings.push({
      code: 'phases_missing',
      severity: 'warning',
      message:
        'Chưa nhận diện được các hoạt động dạy học theo cấu trúc quen thuộc. Hãy thêm hoạt động ở bước xác nhận trước khi luyện tập.',
    });
    return [];
  }
  const phases: LessonPhase[] = blocks.map((entry, index) => {
    const duration = detectDuration(entry.block);
    const teacherActions = extractRoleActions(entry.block, 'teacher');
    const studentActions = extractRoleActions(entry.block, 'student');
    const questions = extractQuestions(entry.block);
    const expectedResponses = extractExpected(entry.block, questions);
    const explicitObjective = entry.block
      .split('\n')
      .map((line) => line.trim())
      .find((line) => /^mục tiêu(?:\s+hoạt động)?\s*[:：]/i.test(line));
    const contentLine = entry.block
      .split('\n')
      .map((line) => cleanLine(line))
      .find(
        (line) =>
          line.length >= 12 &&
          !/^(?:GV|Giáo viên|HS|Học sinh)\b/i.test(line) &&
          !/\?/.test(line) &&
          !/\d+\s*phút/i.test(line) &&
          !/^\d+[.)]/.test(line) &&
          !/^bài\s*\d+/i.test(line),
      );
    const objectiveLine =
      explicitObjective?.replace(/^mục tiêu(?:\s+hoạt động)?\s*[:：]\s*/i, '').trim() ||
      contentLine ||
      `Thực hiện hoạt động ${entry.heading}`;
    let confidence = 0.46;
    if (teacherActions.length) confidence += 0.12;
    if (studentActions.length) confidence += 0.1;
    if (questions.length) confidence += 0.09;
    if (expectedResponses.length) confidence += 0.08;
    if (duration) confidence += 0.05;
    if (entry.type !== 'other') confidence += 0.06;
    if (isPhaseNamedLowConfidence(entry.heading)) confidence -= 0.08;
    confidence = Math.round(Math.min(0.94, Math.max(0.3, confidence)) * 100) / 100;

    return {
      id: uid('phase'),
      order: index + 1,
      name: entry.heading,
      type: entry.type,
      objective: objectiveLine.replace(/\s+/g, ' ').slice(0, 240),
      teacherActions,
      studentActions,
      materials: materials.slice(0, 6),
      questions,
      expectedResponses,
      completionCriteria: [],
      estimatedDurationMin: duration,
      confidence,
      needsReview: confidence < 0.7 || !teacherActions.length || !questions.length,
      sourceExcerpt: entry.block.slice(0, 320).trim(),
    };
  });
  return phases;
}

function buildObjectives(text: string, sections: Section[], phases: LessonPhase[]): LessonObjective[] {
  const objectiveSection = sectionText(sections, ['objectives']);
  const source = objectiveSection || '';
  let bullets = parseBullets(source.split('\n'), 10);
  if (!bullets.length) {
    const sentences = sentenceSplit(text);
    bullets = sentences
      .filter(
        (sentence) =>
          /học sinh|hs\b/i.test(sentence) &&
          /(biết|nêu|nhận|thực hiện|so sánh|giải|vận dụng|đọc|viết|kể|tính|hiểu|phân biệt|trình bày)/i.test(
            sentence,
          ) &&
          sentence.length <= 240,
      )
      .slice(0, 6);
  }
  return bullets.map((bullet) => ({
    id: uid('obj'),
    text: bullet,
    confidence: objectiveSection ? 0.82 : 0.54,
    needsReview: !objectiveSection || bullet.length < 10,
  }));
}

function buildExercises(
  text: string,
  phases: LessonPhase[],
  qa: Array<{ question: string; answer: string }>,
  lessonTitle: string,
): LessonExercise[] {
  const exercises: LessonExercise[] = [];
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed === lessonTitle) return;
    const match = trimmed.match(/^(?:bài|bài tập)\s*(\d{1,2})\s*[:.\-–]\s*(.+)$/i);
    if (!match) return;
    // The first lines normally hold the lesson title/header, not an exercise.
    if (index < 4) return;
    const prompt = `Bài ${match[1]}: ${match[2].trim()}`;
    if (prompt.length < 8) return;
    let expected = '';
    for (let j = index + 1; j < Math.min(index + 8, lines.length); j += 1) {
      const answer = lines[j]
        .trim()
        .match(
          /(?:đáp án|trả lời|dự kiến|chốt(?:\s+lời\s+giải)?)\s*[:：\-–]\s*(.+)$/i,
        );
      if (answer) {
        expected = answer[1].trim();
        break;
      }
    }
    exercises.push({
      id: uid('exercise'),
      prompt: prompt.slice(0, 300),
      expectedAnswer: expected,
      confidence: expected ? 0.7 : 0.45,
      needsReview: true,
    });
  });
  if (!exercises.length) {
    const practice = phases.find((phase) => phase.type === 'practice');
    for (const question of practice?.questions.slice(0, 4) ?? []) {
      const qaMatch = qa.find((entry) => entry.question === question);
      exercises.push({
        id: uid('exercise'),
        prompt: question,
        expectedAnswer: qaMatch?.answer ?? '',
        confidence: 0.5,
        needsReview: true,
      });
    }
  }
  return exercises.slice(0, 12);
}

export function parseLessonText(text: string, meta: ParseMeta): LessonPlan {
  const issues: ParsingIssue[] = [];
  const sections = collectSections(text);
  const grade = extractGrade(text);
  const subject = detectSubject(text);
  const { title, topic } = extractTitle(text, meta.fileName);
  const materialsText = sectionText(sections, ['materials']);
  const materials = parseBullets(materialsText.split('\n'), 10);
  const knowledge = parseBullets(sectionText(sections, ['knowledge']).split('\n'), 12);
  const prerequisites = parseBullets(sectionText(sections, ['prerequisites']).split('\n'), 8);
  const assessment = parseBullets(sectionText(sections, ['assessment']).split('\n'), 10);
  const objectives = buildObjectives(text, sections, []);
  const phases = buildPhases(text, materials, issues);
  const qa = extractQuestionsAndAnswers(text);
  const exercises = buildExercises(text, phases, qa, title);
  const expectedStudentResponses = Array.from(
    new Set(phases.flatMap((phase) => phase.expectedResponses).concat(qa.map((entry) => entry.answer))),
  ).slice(0, 20);

  if (!subject) {
    issues.push({
      code: 'subject_missing',
      severity: 'warning',
      message: 'Chưa xác định được môn học. Hãy chọn môn ở bước xác nhận.',
    });
  }
  if (!grade) {
    issues.push({
      code: 'grade_missing',
      severity: 'warning',
      message: 'Chưa xác định được khối lớp. Hãy chọn lớp ở bước xác nhận.',
    });
  }
  if (!objectives.length) {
    issues.push({
      code: 'objectives_missing',
      severity: 'warning',
      message: 'Không trích xuất được mục tiêu bài học. Hãy nhập mục tiêu ở bước xác nhận.',
    });
  }
  if (!materials.length) {
    issues.push({
      code: 'materials_missing',
      severity: 'info',
      message: 'Không tìm thấy danh mục thiết bị/đồ dùng dạy học trong file.',
    });
  }
  if (!assessment.length) {
    issues.push({
      code: 'assessment_missing',
      severity: 'info',
      message: 'Không tìm thấy tiêu chí đánh giá. Có thể bổ sung ở bước xác nhận.',
    });
  }
  if (phases.length && !phases.some((phase) => phase.questions.length)) {
    issues.push({
      code: 'questions_missing',
      severity: 'info',
      message: 'Chưa nhận diện được câu hỏi trong hoạt động. Hãy bổ sung để lớp học AI tương tác tốt hơn.',
    });
  }

  const confidenceParts = [
    objectives.length ? 0.8 : 0.3,
    phases.length ? Math.min(0.9, 0.45 + phases.length * 0.06) : 0.25,
    subject ? 0.9 : 0.4,
    grade ? 0.95 : 0.4,
    assessment.length ? 0.75 : 0.5,
  ];
  const confidence = Math.round((confidenceParts.reduce((sum, value) => sum + value, 0) / confidenceParts.length) * 100) / 100;

  const now = new Date().toISOString();
  return {
    id: uid('lesson'),
    title,
    subject,
    grade,
    topic,
    fileName: meta.fileName,
    fileType: meta.fileType,
    fileSize: meta.fileSize,
    extractedText: text,
    objectives,
    prerequisiteKnowledge: prerequisites,
    coreKnowledge: knowledge,
    teachingMaterials: materials,
    lessonPhases: phases,
    exercises,
    expectedStudentResponses,
    assessmentCriteria: assessment,
    parsingStatus: 'needs_review',
    parsingIssues: issues,
    confidence,
    createdAt: now,
    updatedAt: now,
    isDemo: false,
  };
}

export const parserInternals = {
  detectPhaseHeading,
  matchSectionHeading,
  detectDuration,
  extractQuestions,
  extractTitle,
  detectSubject,
};
