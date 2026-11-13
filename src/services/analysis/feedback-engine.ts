import type {
  ClassroomEvent,
  FeedbackCategory,
  FeedbackEvent,
  FeedbackSeverity,
  LessonPlan,
  PracticeSession,
  SessionReport,
  TranscriptSegment,
} from '@/types/domain';
import { uid } from '@/lib/utils';
import { detectPraise, detectEncouragement, shorten } from '@/services/nlp/vietnamese';

export interface AudioWindowStats {
  samples: number;
  speakingSec: number;
  avgVolumeDb: number | null;
  volumeStdDb: number | null;
  pauseCount: number;
  longestPauseSec: number;
  wpm: number | null;
}

export interface PoseWindowStats {
  samples: number;
  visibility: number | null;
  stability: number | null;
  movement: number | null;
  gestureRate: number | null;
  brightness: number | null;
  centerOffsetX: number | null;
}

export interface FeedbackSnapshot {
  sessionId: string;
  elapsed: number;
  transcript: TranscriptSegment[];
  classroomEvents: ClassroomEvent[];
  audio: AudioWindowStats;
  pose: PoseWindowStats;
  phase: {
    currentName?: string;
    transitions: number;
    covered: number;
    total: number;
    lastTransitionAt?: number;
  };
  micActive: boolean;
  cameraActive: boolean;
}

interface FeedbackRule {
  id: string;
  category: FeedbackCategory;
  severity: FeedbackSeverity;
  cooldownSec: number;
  minElapsed: number;
  minIntervalSec?: number;
  evaluate: (snapshot: FeedbackSnapshot, context: RuleContext) => RuleResult | null;
}

interface RuleContext {
  lastOccurrence: Map<string, number>;
  once: Set<string>;
}

interface RuleResult {
  observedFact: string;
  interpretation: string;
  explanation: string;
  recommendation: string;
  confidence: number;
  index?: number;
}

const SEVERITY_BASE_CONFIDENCE: Record<FeedbackSeverity, number> = {
  info: 0.62,
  suggestion: 0.68,
  warning: 0.8,
  critical: 0.9,
};

const RULES: FeedbackRule[] = [
  {
    id: 'pose_out_of_frame',
    category: 'posture',
    severity: 'warning',
    cooldownSec: 150,
    minElapsed: 25,
    evaluate: (snapshot) => {
      const { pose } = snapshot;
      if (!snapshot.cameraActive) return null;
      if (pose.samples < 10 || pose.visibility === null) return null;
      if (pose.visibility >= 0.55) return null;
      return {
        observedFact: `Trong ${pose.samples} mẫu phân tích gần nhất, chỉ ${Math.round(pose.visibility * 100)}% khung hình thấy rõ đồng thời đầu, vai và hông.`,
        interpretation:
          'Một phần cơ thể đang ra khỏi vùng quan sát, nên dữ liệu tư thế và cử chỉ bị thiếu và khó đánh giá chính xác.',
        explanation: 'Bạn đang ra khỏi vùng quan sát của camera.',
        recommendation:
          'Điều chỉnh lại camera hoặc bước lùi nhẹ để thấy rõ từ vai đến hông; kiểm tra đèn và tránh đứng ngược sáng.',
        confidence: 0.84,
      };
    },
  },
  {
    id: 'pose_low_light',
    category: 'posture',
    severity: 'info',
    cooldownSec: 240,
    minElapsed: 30,
    evaluate: (snapshot) => {
      const { pose } = snapshot;
      if (!snapshot.cameraActive || pose.samples < 10 || pose.brightness === null) return null;
      if (pose.brightness >= 0.3) return null;
      return {
        observedFact: `Độ sáng trung bình khung hình khoảng ${Math.round(pose.brightness * 100)}% (thang 0–100).`,
        interpretation:
          'Ánh sáng yếu làm giảm độ rõ của hình ảnh và có thể khiến việc nhận diện tư thế kém ổn định.',
        explanation: 'Hình ảnh hơi tối.',
        recommendation: 'Bật thêm đèn hoặc quay về phía nguồn sáng để hình ảnh rõ hơn.',
        confidence: 0.75,
      };
    },
  },
  {
    id: 'pose_too_still',
    category: 'posture',
    severity: 'suggestion',
    cooldownSec: 300,
    minElapsed: 180,
    evaluate: (snapshot) => {
      const { pose } = snapshot;
      if (pose.samples < 45 || pose.gestureRate === null) return null;
      if (pose.gestureRate > 0.02) return null;
      return {
        observedFact: `Chưa ghi nhận cử chỉ tay nào được đưa lên trên vai trong ${Math.round(snapshot.elapsed)} giây vừa qua.`,
        interpretation:
          'Cử chỉ tay giúp học sinh tiểu học chú ý và hiểu nội dung, đặc biệt khi minh họa số lượng hoặc quy trình.',
        explanation: 'Bạn có thể tăng cử chỉ minh họa khi giảng.',
        recommendation:
          'Thử dùng tay để chỉ vào bảng, đếm số lượng hoặc mô tả hành động khi giải thích nội dung mới.',
        confidence: 0.7,
      };
    },
  },
  {
    id: 'pose_too_much_movement',
    category: 'posture',
    severity: 'suggestion',
    cooldownSec: 180,
    minElapsed: 45,
    evaluate: (snapshot) => {
      const { pose } = snapshot;
      if (pose.samples < 20 || pose.movement === null) return null;
      if (pose.movement < 0.6) return null;
      return {
        observedFact: `Chỉ số chuyển động gần đây là ${Math.round(pose.movement * 100)}% (cao hơn mức ổn định thông thường).`,
        interpretation:
          'Di chuyển liên tục có thể làm học sinh khó theo dõi và khiến camera không giữ được khung hình ổn định.',
        explanation: 'Bạn đang di chuyển khá nhiều trước camera.',
        recommendation:
          'Đứng ổn định theo nhịp: nói ý chính tại một vị trí, chỉ di chuyển khi chuyển hoạt động hoặc mời học sinh.',
        confidence: 0.7,
      };
    },
  },
  {
    id: 'voice_low_volume',
    category: 'voice',
    severity: 'warning',
    cooldownSec: 180,
    minElapsed: 35,
    evaluate: (snapshot) => {
      const { audio } = snapshot;
      if (!snapshot.micActive || audio.samples < 20 || audio.avgVolumeDb === null) return null;
      if (audio.avgVolumeDb >= -40 || audio.speakingSec < 15) return null;
      return {
        observedFact: `Âm lượng trung bình khi có tiếng nói khoảng ${Math.round(audio.avgVolumeDb)} dB (mức đo tương đối từ micro).`,
        interpretation:
          'Thu âm nhỏ có thể khiến học sinh ở xa không nghe rõ và làm giảm độ chính xác của nhận dạng lời giảng.',
        explanation: 'Giọng nói chưa đủ lớn so với khoảng cách lớp học.',
        recommendation:
          'Nói to hơn một chút hoặc đưa micro gần hơn; kiểm tra lại mức âm lượng trước khi bắt đầu buổi tiếp theo.',
        confidence: 0.72,
      };
    },
  },
  {
    id: 'voice_monotone',
    category: 'voice',
    severity: 'suggestion',
    cooldownSec: 300,
    minElapsed: 150,
    evaluate: (snapshot) => {
      const { audio } = snapshot;
      if (audio.samples < 40 || audio.volumeStdDb === null || audio.avgVolumeDb === null) return null;
      if (audio.volumeStdDb >= 1.4 || audio.avgVolumeDb < -42) return null;
      return {
        observedFact: `Độ biến thiên âm lượng trong các đoạn nói khoảng ${audio.volumeStdDb.toFixed(1)} dB.`,
        interpretation:
          'Âm lượng khá đều có thể làm giọng giảng thiếu điểm nhấn ở từ khóa hoặc khi đặt câu hỏi.',
        explanation: 'Bạn có thể nhấn nhá hơn ở từ khóa.',
        recommendation:
          'Thử nhấn giọng khi nêu khái niệm mới, hạ giọng khi chuyển ý và tăng âm lượng nhẹ khi đặt câu hỏi cho cả lớp.',
        confidence: 0.62,
      };
    },
  },
  {
    id: 'voice_speak_too_fast',
    category: 'voice',
    severity: 'suggestion',
    cooldownSec: 240,
    minElapsed: 120,
    evaluate: (snapshot) => {
      const { audio } = snapshot;
      if (!audio.wpm || audio.samples < 20) return null;
      if (audio.wpm <= 195) return null;
      return {
        observedFact: `Tốc độ nói ước tính khoảng ${Math.round(audio.wpm)} từ/phút từ lời giảng đã nhận dạng.`,
        interpretation:
          'Học sinh tiểu học cần nhiều thời gian hơn để xử lý câu nói; tốc độ quá nhanh có thể làm các em bỏ lỡ ý.',
        explanation: 'Tốc độ nói hơi nhanh so với nhịp tiếp nhận của học sinh.',
        recommendation:
          'Giảm tốc độ ở phần kiến thức mới, dừng ngắn sau mỗi ý và nhắc lại câu hỏi quan trọng.',
        confidence: 0.68,
      };
    },
  },
  {
    id: 'teacher_talks_too_much',
    category: 'interaction',
    severity: 'warning',
    cooldownSec: 300,
    minElapsed: 180,
    minIntervalSec: 90,
    evaluate: (snapshot) => {
      if (!snapshot.micActive) return null;
      if (snapshot.elapsed < 180) return null;
      const studentTurns = snapshot.classroomEvents.filter((event) =>
        ['ANSWER_QUESTION', 'WRONG_ANSWER', 'INCOMPLETE_ANSWER', 'ASK_QUESTION', 'NEED_HELP'].includes(event.eventType),
      ).length;
      const ratio = snapshot.audio.speakingSec / Math.max(1, snapshot.elapsed);
      if (ratio < 0.85 || studentTurns >= 3) return null;
      return {
        observedFact: `Giáo viên có tiếng nói trong ${Math.round(ratio * 100)}% thời lượng buổi tập, học sinh mới có ${studentTurns} lượt phát biểu.`,
        interpretation:
          'Lớp học tiểu học hiệu quả thường có nhiều thời gian để học sinh nói, giải thích và thử sai hơn là nghe giảng liên tục.',
        explanation: 'Bạn đang nói gần như toàn bộ thời gian của buổi tập.',
        recommendation:
          'Sau mỗi ý chính, dừng lại và đặt câu hỏi cho học sinh; chờ 3–5 giây trước khi gợi ý hoặc gọi một em.',
        confidence: 0.8,
      };
    },
  },
  {
    id: 'few_questions',
    category: 'pedagogy',
    severity: 'suggestion',
    cooldownSec: 300,
    minElapsed: 150,
    evaluate: (snapshot) => {
      const teacherSegments = snapshot.transcript.filter((segment) => segment.speaker === 'teacher');
      if (teacherSegments.length < 4) return null;
      const questions = teacherSegments.filter((segment) => segment.text.includes('?')).length;
      if (questions >= 2) return null;
      return {
        observedFact: `Trong ${teacherSegments.length} lượt lời giảng đã nhận dạng, mới có ${questions} câu hỏi.`,
        interpretation:
          'Câu hỏi giúp kiểm tra mức độ hiểu bài và tạo cơ hội để học sinh tham gia tích cực.',
        explanation: 'Buổi giảng hiện chưa có nhiều câu hỏi cho học sinh.',
        recommendation:
          'Chèn 1–2 câu hỏi kiểm tra hiểu bài sau mỗi phần kiến thức mới, ưu tiên câu hỏi “vì sao” và “theo em”.',
        confidence: 0.76,
      };
    },
  },
  {
    id: 'closed_questions_only',
    category: 'pedagogy',
    severity: 'suggestion',
    cooldownSec: 360,
    minElapsed: 150,
    evaluate: (snapshot) => {
      const questions = snapshot.transcript.filter(
        (segment) => segment.speaker === 'teacher' && segment.text.includes('?'),
      );
      if (questions.length < 6) return null;
      const open = questions.filter((segment) =>
        /(vì sao|tại sao|theo em|theo con|như thế nào|giải thích|so sánh|nêu cách|ví dụ)/i.test(segment.text),
      ).length;
      if (open / questions.length >= 0.25) return null;
      return {
        observedFact: `${questions.length} câu hỏi đã nhận dạng, trong đó ${open} câu hỏi mở hoặc yêu cầu giải thích.`,
        interpretation:
          'Câu hỏi đóng phù hợp để kiểm tra ghi nhớ, nhưng cần thêm câu hỏi mở để phát triển tư duy và diễn đạt.',
        explanation: 'Chuỗi câu hỏi hiện nghiêng về kiểm tra đáp án đúng/sai.',
        recommendation:
          'Thêm một câu hỏi mở sau câu hỏi đóng, ví dụ: “Vì sao em biết kết quả đó đúng?” hoặc “Em có cách làm khác không?”.',
        confidence: 0.7,
      };
    },
  },
  {
    id: 'no_wait_time',
    category: 'pedagogy',
    severity: 'suggestion',
    cooldownSec: 180,
    minElapsed: 60,
    evaluate: (snapshot) => {
      const teacherSegments = snapshot.transcript
        .filter((segment) => segment.speaker === 'teacher')
        .sort((a, b) => a.startTime - b.startTime);
      if (teacherSegments.length < 3) return null;
      let occurrences = 0;
      let latest: TranscriptSegment | null = null;
      for (let index = 0; index < teacherSegments.length - 1; index += 1) {
        const current = teacherSegments[index];
        const next = teacherSegments[index + 1];
        if (!current.text.includes('?')) continue;
        const gap = next.startTime - current.endTime;
        const studentInterrupted = snapshot.classroomEvents.some(
          (event) =>
            event.timestamp > current.endTime - 0.5 &&
            event.timestamp < next.startTime + 0.5 &&
            ['ANSWER_QUESTION', 'WRONG_ANSWER', 'INCOMPLETE_ANSWER', 'ASK_QUESTION', 'NEED_HELP'].includes(
              event.eventType,
            ),
        );
        if (gap < 1.3 && !studentInterrupted) {
          occurrences += 1;
          latest = current;
        }
      }
      if (occurrences < 2 || !latest) return null;
      return {
        observedFact: `${occurrences} lần giáo viên đặt câu hỏi rồi tiếp tục nói trong vòng dưới 1,3 giây.`,
        interpretation:
          'Thời gian chờ cho học sinh suy nghĩ thường cần khoảng 3–5 giây, đặc biệt với câu hỏi mở.',
        explanation: 'Một số câu hỏi chưa có thời gian chờ để học sinh suy nghĩ.',
        recommendation:
          'Sau khi hỏi, dừng 3–5 giây, quan sát học sinh giơ tay rồi mới gọi tên hoặc gợi ý.',
        confidence: 0.78,
        index: latest.startTime,
      };
    },
  },
  {
    id: 'no_praise',
    category: 'interaction',
    severity: 'suggestion',
    cooldownSec: 300,
    minElapsed: 150,
    evaluate: (snapshot) => {
      const answers = snapshot.classroomEvents.filter((event) =>
        ['ANSWER_QUESTION', 'WRONG_ANSWER', 'INCOMPLETE_ANSWER'].includes(event.eventType),
      );
      if (answers.length < 4) return null;
      const praise = snapshot.transcript.filter(
        (segment) => segment.speaker === 'teacher' && detectPraise(segment.text),
      ).length;
      if (praise > 0) return null;
      return {
        observedFact: `Đã có ${answers.length} lượt học sinh trả lời nhưng chưa ghi nhận lời khen hoặc ghi nhận tích cực nào từ giáo viên.`,
        interpretation:
          'Ghi nhận cụ thể giúp học sinh biết mình làm đúng ở đâu và duy trì động lực tham gia.',
        explanation: 'Chưa thấy lời khen sau câu trả lời của học sinh.',
        recommendation:
          'Khen cụ thể điều học sinh làm tốt, ví dụ: “Cô thấy em đã biết dùng phép nhân thay cho cộng lặp lại, rất tốt!”.',
        confidence: 0.74,
      };
    },
  },
  {
    id: 'wrong_answer_not_handled',
    category: 'interaction',
    severity: 'warning',
    cooldownSec: 240,
    minElapsed: 90,
    evaluate: (snapshot) => {
      const wrong = [...snapshot.classroomEvents]
        .filter((event) => ['WRONG_ANSWER', 'INCOMPLETE_ANSWER'].includes(event.eventType))
        .sort((a, b) => a.timestamp - b.timestamp);
      if (!wrong.length) return null;
      const latest = wrong[wrong.length - 1];
      if (snapshot.elapsed - latest.timestamp < 12) return null;
      const response = snapshot.transcript.find(
        (segment) =>
          segment.speaker === 'teacher' &&
          segment.startTime >= latest.timestamp &&
          segment.startTime <= latest.timestamp + 20,
      );
      if (response) {
        const supportive =
          detectEncouragement(response.text) ||
          detectPraise(response.text) ||
          /(gợi ý|thử lại|cách khác|vì sao|con nghĩ|em nghĩ|xem lại)/i.test(response.text);
        if (supportive) return null;
      }
      return {
        observedFact: `Học sinh ${latest.studentName} trả lời chưa đúng lúc ${Math.round(latest.timestamp)} giây, chưa ghi nhận lời dẫn dắt tiếp theo trong 20 giây sau đó.`,
        interpretation:
          'Câu trả lời sai là cơ hội tốt để giáo viên gợi mở thay vì bỏ qua hoặc chuyển sang bạn khác ngay.',
        explanation: 'Câu trả lời chưa đúng chưa được khai thác để dẫn dắt học sinh.',
        recommendation:
          'Hỏi lại tiến trình: “Em đã làm thế nào để ra kết quả này?” rồi gợi ý một bước nhỏ để em tự sửa.',
        confidence: 0.72,
      };
    },
  },
  {
    id: 'many_hands_waiting',
    category: 'interaction',
    severity: 'info',
    cooldownSec: 150,
    minElapsed: 45,
    evaluate: (snapshot) => {
      const hands = snapshot.classroomEvents
        .filter((event) => event.eventType === 'RAISE_HAND')
        .sort((a, b) => a.timestamp - b.timestamp);
      if (hands.length < 2) return null;
      const latest = hands[hands.length - 1];
      if (snapshot.elapsed - latest.timestamp < 15) return null;
      return {
        observedFact: `Ghi nhận ${hands.length} lượt giơ tay; lượt gần nhất cách đây hơn 15 giây.`,
        interpretation:
          'Học sinh giơ tay chờ lâu có thể mất hứng thú hoặc cho rằng ý kiến của mình không được chú ý.',
        explanation: 'Một số học sinh đang chờ được gọi phát biểu.',
        recommendation:
          'Gọi một em đang giơ tay, hoặc ghi nhận: “Cô thấy nhiều bạn giơ tay, cô sẽ mời bạn A trước, các bạn khác chuẩn bị ý kiến nhé.”',
        confidence: 0.66,
      };
    },
  },
  {
    id: 'missing_greeting',
    category: 'pedagogy',
    severity: 'info',
    cooldownSec: 360,
    minElapsed: 75,
    minIntervalSec: 999,
    evaluate: (snapshot) => {
      const teacherSegments = snapshot.transcript.filter((segment) => segment.speaker === 'teacher');
      if (teacherSegments.length < 2) return null;
      const hasGreeting = teacherSegments.some((segment) =>
        /(chào|xin chào|chào các em|chúng ta bắt đầu|hôm nay chúng ta)/i.test(segment.text),
      );
      if (hasGreeting) return null;
      return {
        observedFact: `Chưa ghi nhận lời chào hoặc giới thiệu mở đầu trong ${teacherSegments.length} lượt lời giảng đầu tiên.`,
        interpretation:
          'Mở đầu rõ ràng giúp học sinh biết buổi học bắt đầu, tạo không khí và định hướng nội dung.',
        explanation: 'Phần mở đầu bài học chưa xuất hiện trong lời giảng đã nhận dạng.',
        recommendation:
          'Bắt đầu bằng lời chào ngắn, nêu tên bài và một câu dẫn dắt gần gũi với học sinh.',
        confidence: 0.55,
      };
    },
  },
  {
    id: 'no_transition',
    category: 'organization',
    severity: 'suggestion',
    cooldownSec: 360,
    minElapsed: 240,
    evaluate: (snapshot) => {
      if (snapshot.phase.total < 2) return null;
      if (snapshot.phase.covered < 2) return null;
      const teacherSegments = snapshot.transcript.filter((segment) => segment.speaker === 'teacher');
      if (teacherSegments.length < 8) return null;
      const transitions = teacherSegments.filter((segment) => /(chuyển sang|tiếp theo|bây giờ chúng ta|sang hoạt động|kết thúc hoạt động)/i.test(segment.text)).length;
      if (transitions > 0) return null;
      return {
        observedFact: `Đã ghi nhận nội dung của ${snapshot.phase.covered} hoạt động nhưng chưa có câu chuyển ý rõ ràng.`,
        interpretation:
          'Câu chuyển giúp học sinh theo dõi mạch bài và biết mình đang bước sang nhiệm vụ mới.',
        explanation: 'Các hoạt động đang chuyển tiếp mà thiếu lời dẫn.',
        recommendation:
          'Dùng câu chuyển ngắn: “Chúng ta vừa hoàn thành… Bây giờ cô trò mình cùng chuyển sang…”.',
        confidence: 0.64,
      };
    },
  },
  {
    id: 'distracted_needs_support',
    category: 'interaction',
    severity: 'info',
    cooldownSec: 180,
    minElapsed: 30,
    evaluate: (snapshot) => {
      const distracted = snapshot.classroomEvents
        .filter((event) => ['DISTRACTED', 'NEED_HELP'].includes(event.eventType))
        .sort((a, b) => a.timestamp - b.timestamp);
      if (!distracted.length) return null;
      const latest = distracted[distracted.length - 1];
      if (snapshot.elapsed - latest.timestamp < 10 || snapshot.elapsed - latest.timestamp > 30) return null;
      return {
        observedFact: `${latest.studentName} vừa ${latest.eventType === 'DISTRACTED' ? 'mất tập trung' : 'xin hỗ trợ'} lúc ${Math.round(latest.timestamp)} giây.`,
        interpretation:
          'Phản hồi sớm và nhẹ nhàng giúp học sinh quay lại nhiệm vụ mà không làm gián đoạn cả lớp.',
        explanation: `Có thể phản hồi để hỗ trợ ${latest.studentName}.`,
        recommendation:
          latest.eventType === 'DISTRACTED'
            ? `Nhắc nhẹ: “Cô mời ${latest.studentName} cùng quan sát lên bảng và cho cô biết em thấy gì nhé.”`
            : `Gợi ý một bước nhỏ hoặc hỏi lại: “Em đang vướng ở chỗ nào, nói cô nghe nào?”`,
        confidence: 0.72,
      };
    },
  },
];

const FREQUENCY_CONFIG: Record<
  'low' | 'normal' | 'high',
  { minGapSec: number; severityFilter: FeedbackSeverity[]; cooldownMultiplier: number }
> = {
  low: { minGapSec: 100, severityFilter: ['warning', 'critical'], cooldownMultiplier: 1.6 },
  normal: { minGapSec: 45, severityFilter: ['info', 'suggestion', 'warning', 'critical'], cooldownMultiplier: 1 },
  high: { minGapSec: 25, severityFilter: ['info', 'suggestion', 'warning', 'critical'], cooldownMultiplier: 0.65 },
};

export class FeedbackEngine {
  private frequency: 'low' | 'normal' | 'high';
  private lastEmittedAt = new Map<string, number>();
  private onceFired = new Set<string>();
  private lastAnyFeedbackAt = -999;
  private lastEvaluationAt = -999;
  private recentFacts: string[] = [];

  constructor(frequency: 'low' | 'normal' | 'high') {
    this.frequency = frequency;
  }

  setFrequency(frequency: 'low' | 'normal' | 'high') {
    this.frequency = frequency;
  }

  /** Runs at most once every 4 seconds to avoid noisy coaching. */
  evaluate(snapshot: FeedbackSnapshot): FeedbackEvent | null {
    if (snapshot.elapsed - this.lastEvaluationAt < 4) return null;
    this.lastEvaluationAt = snapshot.elapsed;
    const config = FREQUENCY_CONFIG[this.frequency];
    if (snapshot.elapsed - this.lastAnyFeedbackAt < config.minGapSec) return null;

    const context: RuleContext = { lastOccurrence: this.lastEmittedAt, once: this.onceFired };
    const candidates: Array<{ rule: FeedbackRule; result: RuleResult }> = [];
    for (const rule of RULES) {
      if (!config.severityFilter.includes(rule.severity)) continue;
      if (snapshot.elapsed < rule.minElapsed) continue;
      if (this.onceFired.has(rule.id) && rule.id === 'missing_greeting') continue;
      const last = this.lastEmittedAt.get(rule.id);
      if (last !== undefined && snapshot.elapsed - last < rule.cooldownSec * config.cooldownMultiplier) continue;
      if (rule.minIntervalSec && last !== undefined && snapshot.elapsed - last < rule.minIntervalSec) continue;
      const result = rule.evaluate(snapshot, context);
      if (!result) continue;
      if (result.confidence < 0.55) continue;
      if (this.recentFacts.slice(-2).some((fact) => fact === result.explanation)) continue;
      candidates.push({ rule, result });
    }
    if (!candidates.length) return null;

    candidates.sort((a, b) => {
      const severityRank: Record<FeedbackSeverity, number> = { critical: 4, warning: 3, suggestion: 2, info: 1 };
      const severityDiff = severityRank[b.rule.severity] - severityRank[a.rule.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.result.confidence - a.result.confidence;
    });

    const chosen = candidates[0];
    const timestamp = chosen.result.index ?? snapshot.elapsed;
    const event: FeedbackEvent = {
      id: uid('feedback'),
      sessionId: snapshot.sessionId,
      timestamp,
      category: chosen.rule.category,
      severity: chosen.rule.severity,
      ruleId: chosen.rule.id,
      evidence: {
        id: uid('evidence'),
        timestamp,
        source:
          chosen.rule.category === 'posture'
            ? 'pose'
            : chosen.rule.category === 'voice'
              ? 'audio'
              : chosen.rule.category === 'interaction' || chosen.rule.id.includes('hand')
                ? 'classroom'
                : 'transcript',
        observedFact: chosen.result.observedFact,
        interpretation: chosen.result.interpretation,
        confidence: chosen.result.confidence,
        sessionId: snapshot.sessionId,
      },
      explanation: chosen.result.explanation,
      recommendation: chosen.result.recommendation,
      confidence: Math.max(SEVERITY_BASE_CONFIDENCE[chosen.rule.severity], chosen.result.confidence),
      live: true,
      pinned: false,
      dismissed: false,
      helpful: null,
    };
    this.lastEmittedAt.set(chosen.rule.id, snapshot.elapsed);
    if (chosen.rule.id === 'missing_greeting') this.onceFired.add(chosen.rule.id);
    this.lastAnyFeedbackAt = snapshot.elapsed;
    this.recentFacts.push(chosen.result.explanation);
    if (this.recentFacts.length > 6) this.recentFacts.shift();
    return event;
  }
}

export function feedbackFrequencyDescription(frequency: 'low' | 'normal' | 'high'): string {
  if (frequency === 'low') return 'Chỉ nhắc các vấn đề quan trọng, cách nhau ít nhất 100 giây.';
  if (frequency === 'high') return 'Nhắc thường xuyên hơn (tối thiểu 25 giây giữa hai gợi ý).';
  return 'Cân bằng giữa gợi ý và tập trung giảng bài (tối thiểu 45 giây).';
}

export function summarizeFeedbackForReport(feedback: FeedbackEvent[]): {
  counts: Record<FeedbackSeverity, number>;
  byCategory: Record<string, number>;
  topWarnings: FeedbackEvent[];
} {
  const counts: Record<FeedbackSeverity, number> = { info: 0, suggestion: 0, warning: 0, critical: 0 };
  const byCategory: Record<string, number> = {};
  for (const event of feedback) {
    counts[event.severity] += 1;
    byCategory[event.category] = (byCategory[event.category] ?? 0) + 1;
  }
  const topWarnings = feedback
    .filter((event) => event.severity === 'warning' || event.severity === 'critical')
    .slice(-3);
  return { counts, byCategory, topWarnings };
}

export function latestFeedbackHint(feedback: FeedbackEvent | null): string {
  if (!feedback) return 'Chưa có gợi ý mới. Hãy tiếp tục giảng bài tự nhiên.';
  return shorten(feedback.recommendation, 180);
}
