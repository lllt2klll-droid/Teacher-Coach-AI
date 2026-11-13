import type {
  LearningLevel,
  ParticipationStyle,
  StudentBehaviorRules,
  StudentPersona,
  StudentResponseStyle,
} from '@/types/domain';

interface PersonaSpec {
  name: string;
  level: LearningLevel;
  style: ParticipationStyle;
  seed: number;
  color: string;
  note?: string;
}

const PALETTE = [
  '#7FA8FF',
  '#9B8CF6',
  '#63C6B4',
  '#F3A86B',
  '#E7829A',
  '#5FB6E8',
  '#B795E8',
  '#75C98E',
  '#F2B84B',
  '#E08D7C',
];

const SPECS: PersonaSpec[] = [
  {
    name: 'Minh Anh',
    level: 'advanced',
    style: 'active',
    seed: 3,
    color: PALETTE[0],
    note: 'Hay giơ tay và trả lời nhanh, đôi khi chưa giải thích đầy đủ.',
  },
  {
    name: 'Gia Bảo',
    level: 'developing',
    style: 'distracted',
    seed: 7,
    color: PALETTE[1],
    note: 'Dễ bị cuốn hút bởi đồ vật xung quanh, cần được nhắc nhẹ nhàng.',
  },
  {
    name: 'Khánh Linh',
    level: 'proficient',
    style: 'shy',
    seed: 12,
    color: PALETTE[4],
    note: 'Biết bài nhưng ngại phát biểu, cần lời khích lệ trước khi trả lời.',
  },
  {
    name: 'Đức Huy',
    level: 'needs_support',
    style: 'support',
    seed: 5,
    color: PALETTE[3],
    note: 'Thường nhầm phép nhân với phép cộng, cần ví dụ trực quan.',
  },
  {
    name: 'Bảo Ngọc',
    level: 'advanced',
    style: 'high_achiever',
    seed: 15,
    color: PALETTE[6],
    note: 'Thích giải thích cách làm và đặt câu hỏi mở rộng.',
  },
  {
    name: 'Quốc Anh',
    level: 'proficient',
    style: 'curious',
    seed: 8,
    color: PALETTE[2],
    note: 'Hay hỏi “vì sao”, quan tâm đến bản chất kiến thức.',
  },
  {
    name: 'Thảo Nhi',
    level: 'developing',
    style: 'shy',
    seed: 18,
    color: PALETTE[5],
    note: 'Nói nhỏ, cần thời gian suy nghĩ trước khi trả lời.',
  },
  {
    name: 'Hoàng Nam',
    level: 'developing',
    style: 'active',
    seed: 21,
    color: PALETTE[7],
    note: 'Hăng hái nhưng câu trả lời đôi khi còn thiếu ý.',
  },
  {
    name: 'Tuyết Mai',
    level: 'developing',
    style: 'shy',
    seed: 25,
    color: PALETTE[8],
    note: 'Chỉ phát biểu khi được gọi tên.',
  },
  {
    name: 'Trí Dũng',
    level: 'needs_support',
    style: 'distracted',
    seed: 30,
    color: PALETTE[9],
    note: 'Cần cấu trúc nhiệm vụ rõ ràng và thời gian làm bài ngắn.',
  },
  {
    name: 'Ngọc Diệp',
    level: 'proficient',
    style: 'active',
    seed: 33,
    color: PALETTE[4],
    note: 'Tự tin, thích được giao nhiệm vụ nhóm.',
  },
  {
    name: 'Hữu Phúc',
    level: 'developing',
    style: 'support',
    seed: 36,
    color: PALETTE[0],
    note: 'Cần nhắc lại quy tắc trước khi làm bài.',
  },
  {
    name: 'Lan Anh',
    level: 'advanced',
    style: 'high_achiever',
    seed: 40,
    color: PALETTE[2],
    note: 'Hoàn thành nhanh, có thể giúp bạn cùng nhóm.',
  },
  {
    name: 'Tuấn Kiệt',
    level: 'developing',
    style: 'curious',
    seed: 44,
    color: PALETTE[3],
    note: 'Hỏi nhiều câu hỏi ngoài nội dung, cần hướng vào trọng tâm.',
  },
  {
    name: 'Hà My',
    level: 'developing',
    style: 'active',
    seed: 47,
    color: PALETTE[5],
    note: 'Thích tham gia trò chơi khởi động.',
  },
  {
    name: 'Đình Khang',
    level: 'proficient',
    style: 'distracted',
    seed: 52,
    color: PALETTE[6],
    note: 'Làm được bài nhưng dễ bỏ sót yêu cầu khi nghe nhanh.',
  },
  {
    name: 'Phương Thảo',
    level: 'needs_support',
    style: 'shy',
    seed: 56,
    color: PALETTE[7],
    note: 'Rất ngại trả lời trước lớp, cần câu hỏi ngắn.',
  },
  {
    name: 'Văn Hùng',
    level: 'developing',
    style: 'support',
    seed: 60,
    color: PALETTE[8],
    note: 'Cần giáo viên kiểm tra lại kết quả sau mỗi bài.',
  },
  {
    name: 'Mai Chi',
    level: 'advanced',
    style: 'curious',
    seed: 64,
    color: PALETTE[2],
    note: 'Thích tìm quy luật và đặt câu hỏi “nếu… thì sao”.',
  },
  {
    name: 'Nhật Minh',
    level: 'needs_support',
    style: 'active',
    seed: 68,
    color: PALETTE[0],
    note: 'Hăng hái nhưng cần hỗ trợ để đi đúng hướng.',
  },
];

const BASE_MASTERY: Record<LearningLevel, number> = {
  needs_support: 0.32,
  developing: 0.55,
  proficient: 0.76,
  advanced: 0.9,
};

function behaviorForStyle(style: ParticipationStyle): StudentBehaviorRules {
  const defaults: Record<ParticipationStyle, StudentBehaviorRules> = {
    active: {
      handRaiseProbability: 0.72,
      distractionProbability: 0.12,
      needsEncouragement: false,
      answersWhenCalled: true,
      speaksWithoutPrompt: false,
    },
    shy: {
      handRaiseProbability: 0.16,
      distractionProbability: 0.06,
      needsEncouragement: true,
      answersWhenCalled: true,
      speaksWithoutPrompt: false,
    },
    support: {
      handRaiseProbability: 0.26,
      distractionProbability: 0.2,
      needsEncouragement: true,
      answersWhenCalled: true,
      speaksWithoutPrompt: false,
    },
    curious: {
      handRaiseProbability: 0.6,
      distractionProbability: 0.16,
      needsEncouragement: false,
      answersWhenCalled: true,
      speaksWithoutPrompt: true,
    },
    distracted: {
      handRaiseProbability: 0.2,
      distractionProbability: 0.5,
      needsEncouragement: true,
      answersWhenCalled: true,
      speaksWithoutPrompt: false,
    },
    high_achiever: {
      handRaiseProbability: 0.8,
      distractionProbability: 0.05,
      needsEncouragement: false,
      answersWhenCalled: true,
      speaksWithoutPrompt: true,
    },
  };
  return defaults[style];
}

function responseStyleFor(style: ParticipationStyle): StudentResponseStyle {
  switch (style) {
    case 'active':
      return {
        sentenceLength: 'medium',
        usesHesitation: false,
        confidenceTone: 'eager',
        commonPhrases: ['Thưa cô,', 'Em xin phép trả lời ạ.', 'Em làm xong rồi ạ!'],
      };
    case 'shy':
      return {
        sentenceLength: 'short',
        usesHesitation: true,
        confidenceTone: 'timid',
        commonPhrases: ['Dạ…', 'Em nghĩ là…', 'Thưa cô, em…'],
      };
    case 'support':
      return {
        sentenceLength: 'short',
        usesHesitation: true,
        confidenceTone: 'timid',
        commonPhrases: ['Dạ, có phải…', 'Thưa cô, em chưa chắc ạ.', 'Cô giúp em với ạ.'],
      };
    case 'curious':
      return {
        sentenceLength: 'medium',
        usesHesitation: false,
        confidenceTone: 'eager',
        commonPhrases: ['Thưa cô,', 'Cô ơi, vì sao', 'Em thắc mắc là…'],
      };
    case 'distracted':
      return {
        sentenceLength: 'short',
        usesHesitation: true,
        confidenceTone: 'neutral',
        commonPhrases: ['Ơ…', 'Dạ?', 'Thưa cô, em chưa nghe rõ.'],
      };
    case 'high_achiever':
      return {
        sentenceLength: 'long',
        usesHesitation: false,
        confidenceTone: 'eager',
        commonPhrases: ['Thưa cô, em có cách làm như sau:', 'Em xin trình bày ạ.', 'Em có thể giải thích thêm ạ.'],
      };
  }
}

const MISCONCEPTIONS: Record<string, string[]> = {
  math: [
    'Nhầm phép nhân với phép cộng (ví dụ 3 × 4 thành 3 + 4)',
    'Đếm thiếu một nhóm khi cộng lặp lại',
    'Chưa thuộc thứ tự bảng nhân',
  ],
  reading: ['Nhầm từ chỉ sự vật với từ chỉ hoạt động', 'Đọc thiếu dấu câu', 'Chưa hiểu nghĩa từ mới trong ngữ cảnh'],
};

export function createPersonaFromSpec(spec: PersonaSpec, grade = 2, isDemo = false): StudentPersona {
  const base = BASE_MASTERY[spec.level];
  const knowledgeState: Record<string, number> = {
    'phép nhân': Math.min(1, base + 0.03),
    'bảng nhân': Math.max(0.1, base - 0.06),
    'tiếng việt': Math.min(1, base + 0.02),
    'tập đọc': Math.min(1, base + 0.05),
    'toán': base,
  };
  const misconceptionProfile =
    spec.level === 'advanced'
      ? ['Có thể trả lời nhanh nhưng đôi khi chưa giải thích đầy đủ']
      : MISCONCEPTIONS.math;
  return {
    id: `student_${spec.seed}`,
    name: spec.name,
    avatarSeed: spec.seed,
    color: spec.color,
    grade,
    learningLevel: spec.level,
    participationStyle: spec.style,
    knowledgeState,
    misconceptionProfile,
    responseStyle: responseStyleFor(spec.style),
    behaviorRules: behaviorForStyle(spec.style),
    participationRate:
      spec.style === 'active' || spec.style === 'high_achiever'
        ? 0.85
        : spec.style === 'shy'
          ? 0.28
          : spec.style === 'distracted'
            ? 0.4
            : 0.6,
    notes: spec.note,
    isDemo,
  };
}

export function buildDefaultPersonas(grade = 2, count = 10, isDemo = false): StudentPersona[] {
  return SPECS.slice(0, Math.min(count, SPECS.length)).map((spec) => createPersonaFromSpec(spec, grade, isDemo));
}

export function buildAllDefaultPersonas(grade = 2, isDemo = false): StudentPersona[] {
  return SPECS.map((spec) => createPersonaFromSpec(spec, grade, isDemo));
}

export const DEFAULT_PERSONA_COUNT = SPECS.length;
