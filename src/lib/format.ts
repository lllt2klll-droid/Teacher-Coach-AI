import type {
  FeedbackCategory,
  FeedbackSeverity,
  LearningLevel,
  LessonPhaseType,
  ParticipationStyle,
  PresentationLayout,
  ScenarioType,
  SessionMode,
  TrainingGroup,
} from '@/types/domain';

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDate(iso: string, withTime = false): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function formatRelative(iso: string): string {
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return '—';
  const diff = Date.now() - date;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return formatDate(iso);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} phút`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  pedagogy: 'Ngôn ngữ sư phạm',
  voice: 'Giọng nói',
  posture: 'Tư thế và cử chỉ',
  organization: 'Tổ chức hoạt động',
  interaction: 'Tương tác và xử lý',
  presentation: 'Tác phong trình bày',
};

export const CATEGORY_SHORT: Record<FeedbackCategory, string> = {
  pedagogy: 'Ngôn ngữ',
  voice: 'Giọng nói',
  posture: 'Tư thế',
  organization: 'Tổ chức',
  interaction: 'Tương tác',
  presentation: 'Tác phong',
};

export const CATEGORY_WEIGHTS: Record<FeedbackCategory, number> = {
  pedagogy: 0.25,
  organization: 0.15,
  interaction: 0.15,
  voice: 0.2,
  posture: 0.2,
  presentation: 0.05,
};

export const SEVERITY_LABELS: Record<FeedbackSeverity, string> = {
  info: 'Thông tin',
  suggestion: 'Gợi ý',
  warning: 'Cần chú ý',
  critical: 'Nghiêm trọng',
};

export const PHASE_TYPE_LABELS: Record<LessonPhaseType, string> = {
  warmup: 'Khởi động',
  exploration: 'Khám phá',
  knowledge: 'Hình thành kiến thức',
  practice: 'Luyện tập',
  application: 'Vận dụng',
  consolidation: 'Củng cố',
  other: 'Khác',
};

export const PHASE_TYPE_SHORT: Record<LessonPhaseType, string> = {
  warmup: 'Khởi động',
  exploration: 'Khám phá',
  knowledge: 'Kiến thức mới',
  practice: 'Luyện tập',
  application: 'Vận dụng',
  consolidation: 'Củng cố',
  other: 'Khác',
};

export const LEARNING_LEVEL_LABELS: Record<LearningLevel, string> = {
  needs_support: 'Cần hỗ trợ',
  developing: 'Đang phát triển',
  proficient: 'Khá',
  advanced: 'Nổi bật',
};

export const PARTICIPATION_LABELS: Record<ParticipationStyle, string> = {
  active: 'Tích cực',
  shy: 'Nhút nhát',
  support: 'Cần hỗ trợ',
  curious: 'Tò mò',
  distracted: 'Dễ mất tập trung',
  high_achiever: 'Khá giỏi',
};

export const MODE_LABELS: Record<SessionMode, string> = {
  natural: 'Lớp học tự nhiên',
  scenario: 'Tình huống luyện tập',
  focused: 'Luyện tập trọng tâm',
};

export const PRESENTATION_LAYOUT_LABELS: Record<PresentationLayout, string> = {
  slide_main: 'Slide chính + camera nhỏ',
  tabs: 'Tab Camera / Slide',
  side: 'Slide ở cột phải',
  window: 'Cửa sổ trình chiếu riêng',
};

export const PRESENTATION_LAYOUT_HINTS: Record<PresentationLayout, string> = {
  slide_main: 'Slide chiếm vùng lớn, camera thu nhỏ ở góc để mô phỏng dạy bằng PowerPoint.',
  tabs: 'Giữ camera hiện tại và thêm tab để chuyển sang xem slide.',
  side: 'Camera vẫn là trung tâm, slide nhỏ hơn nằm bên cạnh.',
  window: 'Mở slide trong cửa sổ trình chiếu riêng; phòng luyện vẫn chạy phía sau.',
};

export const SCENARIO_LABELS: Record<ScenarioType, string> = {
  wrong_answer: 'Học sinh trả lời sai',
  not_understanding: 'Học sinh không hiểu bài',
  distracted: 'Học sinh mất tập trung',
  silent_student: 'Học sinh không tham gia',
  off_topic_question: 'Học sinh hỏi ngoài bài',
  many_hands: 'Nhiều học sinh cùng giơ tay',
  exercise_mistake: 'Học sinh làm bài sai',
  debate: 'Học sinh tranh luận',
};

export const TRAINING_GROUP_LABELS: Record<TrainingGroup, string> = {
  voice: 'Luyện giọng nói',
  posture: 'Luyện tư thế',
  questioning: 'Luyện đặt câu hỏi',
  language: 'Ngôn ngữ sư phạm',
  opening: 'Mở đầu bài học',
  transition: 'Chuyển hoạt động',
  situations: 'Xử lý tình huống',
  interaction: 'Tương tác học sinh',
};

export const TRAINING_GROUP_ICONS: Record<TrainingGroup, string> = {
  voice: 'audio',
  posture: 'pose',
  questioning: 'help',
  language: 'message',
  opening: 'play',
  transition: 'shuffle',
  situations: 'alert',
  interaction: 'users',
};

export const SUBJECT_OPTIONS = [
  'Toán',
  'Tiếng Việt',
  'Tự nhiên và Xã hội',
  'Đạo đức',
  'Âm nhạc',
  'Mĩ thuật',
  'Giáo dục thể chất',
  'Tin học',
  'Tiếng Anh',
  'Hoạt động trải nghiệm',
];

export const GRADE_OPTIONS = [1, 2, 3, 4, 5];

export const STUDENT_COUNTS = [5, 10, 20] as const;
