import type {
  AnswerQuality,
  ClassroomEvent,
  ClassroomEventType,
  Difficulty,
  LessonPlan,
  PresentationContext,
  ScenarioType,
  SessionMode,
  StudentAvatarState,
  StudentPersona,
  TeacherIntent,
} from '@/types/domain';
import type { AIProvider } from '@/providers/types';
import { masteryForStudent } from '@/providers/local/local-provider';
import { detectTeacherIntent, type TeacherIntentResult } from '@/services/nlp/vietnamese';
import { PhaseTracker } from '@/services/lesson/lesson-context';
import { createRng, hashString } from '@/lib/rng';
import { uid } from '@/lib/utils';

export interface SimulationConfig {
  sessionId: string;
  mode: SessionMode;
  scenario?: ScenarioType;
  difficulty: Difficulty;
  studentActivity: number;
}

export interface SimulationCallbacks {
  onEvent: (event: ClassroomEvent) => void;
  onStates: (states: Record<string, StudentAvatarState>) => void;
  onPhaseChange?: (phaseId: string | null, confidence: number, reason: string) => void;
  onRaisedHands?: (studentIds: string[]) => void;
}

interface QueuedTurn {
  id: string;
  due: number;
  run: () => Promise<void> | void;
}

interface RuntimeStudent {
  persona: StudentPersona;
  mastery: number;
  state: StudentAvatarState;
  handRaisedAt?: number;
  thinkingSince?: number;
  confusedSince?: number;
  hasSpoken: boolean;
  speakCount: number;
}

const HAND_TIMEOUT_SEC = 22;

const STYLE_WEIGHT: Record<StudentPersona['participationStyle'], number> = {
  active: 3.2,
  high_achiever: 2.9,
  curious: 2.3,
  support: 1.15,
  distracted: 0.9,
  shy: 0.75,
};

const CONCEPTUAL_SCENARIOS: ScenarioType[] = ['wrong_answer', 'not_understanding', 'distracted', 'silent_student', 'off_topic_question', 'many_hands', 'exercise_mistake', 'debate'];

/**
 * Turn controller + student simulation controller.
 *
 * Runs entirely client-side. Responses come from the configured AI provider
 * (rule-based local or Gemini proxy), never from a canned script. Persona
 * consistency is enforced by mastery, participation style and recent turns.
 */
export class ClassroomSimulation {
  private lesson: LessonPlan;
  private config: SimulationConfig;
  private callbacks: SimulationCallbacks;
  private provider: AIProvider;
  private clock: () => number;
  private rng: () => number;
  private tracker: PhaseTracker;
  private students = new Map<string, RuntimeStudent>();
  private queue: QueuedTurn[] = [];
  private recentTurns: Array<{ speaker: 'teacher' | 'student'; text: string }> = [];
  private history: ClassroomEvent[] = [];
  private speakingId: string | null = null;
  private turnBusy = false;
  private paused = false;
  private started = false;
  private stopped = false;
  private nextHandAt = 0;
  private scenarioUses = 0;
  private distractedTriggered = false;
  private pendingQuestion: string | null = null;
  private pendingIntent: TeacherIntent | null = null;
  private turnCount = 0;
  private lastSpeakerId: string | null = null;
  private phaseConfidence = 0;
  private elapsedAtStart = 0;
  private presentationContext: PresentationContext | null = null;

  constructor(
    lesson: LessonPlan,
    personas: StudentPersona[],
    config: SimulationConfig,
    callbacks: SimulationCallbacks,
    provider: AIProvider,
    clock: () => number,
    seed?: number,
  ) {
    this.lesson = lesson;
    this.config = config;
    this.callbacks = callbacks;
    this.provider = provider;
    this.clock = clock;
    this.rng = createRng(seed ?? hashString(`${lesson.id}:${Date.now()}`));
    this.tracker = new PhaseTracker(lesson, config.mode === 'focused' ? lesson.lessonPhases[0]?.id : undefined);
    for (const persona of personas) {
      this.students.set(persona.id, {
        persona,
        mastery: masteryForStudent(persona, lesson),
        state: 'idle',
        hasSpoken: false,
        speakCount: 0,
      });
    }
    if (config.mode === 'focused') {
      this.nextHandAt = Number.POSITIVE_INFINITY;
    }
    this.emitStates();
  }

  /* ----------------------------- lifecycle ----------------------------- */

  start() {
    this.started = true;
    this.stopped = false;
    this.elapsedAtStart = this.clock();
    this.nextHandAt = this.clock() + this.spontaneousInterval();
    this.emitStates();
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  stop() {
    this.stopped = true;
    this.queue = [];
    this.speakingId = null;
    for (const student of this.students.values()) {
      student.state = 'idle';
      student.handRaisedAt = undefined;
    }
    this.emitStates();
  }

  setConfig(config: Partial<SimulationConfig>) {
    this.config = { ...this.config, ...config };
  }

  setPhaseManually(phaseId: string | null) {
    this.tracker.setPhase(phaseId, true);
    this.phaseConfidence = 1;
    this.callbacks.onPhaseChange?.(phaseId, 1, 'Giáo viên tự chọn hoạt động');
  }

  setPresentationContext(context: PresentationContext | null) {
    this.presentationContext = context;
  }

  getCurrentPhaseId(): string | null {
    return this.tracker.getCurrentPhaseId();
  }

  getStudents(): StudentPersona[] {
    return Array.from(this.students.values()).map((student) => student.persona);
  }

  getRecentTurns() {
    return this.recentTurns.slice(-8);
  }

  getHistory() {
    return this.history;
  }

  getMastery(studentId: string): number {
    return this.students.get(studentId)?.mastery ?? 0;
  }

  getRaisedHands(): string[] {
    return Array.from(this.students.values())
      .filter((student) => student.handRaisedAt !== undefined)
      .map((student) => student.persona.id);
  }

  /* ------------------------------- tick ------------------------------- */

  tick(now?: number) {
    if (!this.started || this.stopped) return;
    if (typeof now === 'number') {
      // The clock is owned by the session; engine uses the injected clock.
    }
    if (this.paused) return;
    const current = this.clock();

    if (this.config.scenario === 'distracted' && !this.distractedTriggered && current - this.elapsedAtStart >= 12) {
      this.distractedTriggered = true;
      const student = this.pickDistractedStudent();
      if (student) {
        this.setStudentState(student.persona.id, 'confused', 'scenario');
        this.enqueue(0, () => {
          this.emitStudentEvent({
            student,
            eventType: 'DISTRACTED',
            text: 'Cô ơi… em đang tìm thước kẻ trong cặp ạ.',
            quality: 'neutral',
            intent: 'unknown',
            confidence: 0.7,
            source: 'local_rules',
          });
          this.restoreState(student.persona.id);
        });
      }
    }

    if (current >= this.nextHandAt && !this.turnBusy && !this.speakingId) {
      this.nextHandAt = current + this.spontaneousInterval();
      this.raiseRandomHands(current);
    }

    this.dropStaleHands(current);
    void this.processQueue();
  }

  /* ------------------------- teacher utterance ------------------------ */

  async handleTeacherUtterance(text: string, intentInput?: TeacherIntentResult): Promise<TeacherIntentResult> {
    const intentResult =
      intentInput ?? detectTeacherIntent(text, this.getStudents().map((student) => student.name));
    if (!this.started || this.stopped || this.paused) return intentResult;
    this.turnCount += 1;
    this.recentTurns.push({ speaker: 'teacher', text });
    if (this.recentTurns.length > 20) this.recentTurns.shift();

    const detection = this.tracker.evaluate(text);
    if (detection.phaseId && detection.phaseId !== this.tracker.getCurrentPhaseId()) {
      this.callbacks.onPhaseChange?.(detection.phaseId, detection.confidence, detection.reason);
    } else if (detection.phaseId && detection.confidence > 0) {
      this.callbacks.onPhaseChange?.(detection.phaseId, detection.confidence, detection.reason);
    }
    this.phaseConfidence = detection.confidence;

    const { intent } = intentResult;
    this.pendingIntent = intent;
    this.pendingQuestion = intentResult.question?.isQuestion ? text : null;

    if (this.config.mode === 'focused') {
      // Focused exercises still include students for interaction practice.
      if (!['question', 'check_understanding', 'greeting', 'call_student'].includes(intent)) return intentResult;
    }

    if (intent === 'greeting') {
      const responder = this.pickResponder({ styles: ['active', 'high_achiever'] });
      if (responder) {
        this.enqueue(1.2, () => this.speak(responder.persona.id, text, 'greeting', 0.92));
      }
      return intentResult;
    }

    if (intent === 'call_student') {
      const named = intentResult.calledStudentName
        ? this.getStudents().find((student) => student.name === intentResult.calledStudentName)
        : null;
      const target = named ? this.students.get(named.id) : this.pickResponder({ preferSpoken: false });
      if (target) {
        this.lowerHand(target.persona.id);
        this.pendingQuestion = intentResult.question?.isQuestion ? text : null;
        this.enqueue(0.7, () => this.speak(target.persona.id, this.pendingQuestion ?? text, intent, 0.86));
      }
      return intentResult;
    }

    if (intent === 'question' || intent === 'check_understanding') {
      this.setStudentStateAll(undefined, 'thinking');
      this.handleQuestion(text, intentResult, intent);
      return intentResult;
    }

    if (intent === 'instruction' || intent === 'group_work' || intent === 'exercise') {
      this.handleInstruction(text, intent);
      return intentResult;
    }

    if (intent === 'praise') {
      const last = this.lastSpeakerId ? this.students.get(this.lastSpeakerId) : null;
      if (last && this.rng() < 0.45) {
        this.enqueue(1.2, () => this.speak(last.persona.id, text, 'praise', 0.8));
      }
      return intentResult;
    }

    if (intent === 'explanation') {
      const support = this.pickResponder({ styles: ['support', 'shy'] });
      if (support && this.rng() < 0.28) {
        this.enqueue(3.2, async () => {
          this.setStudentState(support.persona.id, 'thinking');
          this.emitStudentEvent({
            student: support,
            eventType: 'NEED_HELP',
            text: 'Thưa cô, đoạn này em chưa hiểu lắm ạ. Cô giảng lại giúp em được không ạ?',
            quality: 'neutral',
            intent,
            confidence: 0.72,
            source: 'local_rules',
          });
          this.restoreState(support.persona.id);
        });
      }
      return intentResult;
    }

    if (intent === 'transition') {
      for (const student of this.students.values()) {
        if (student.state === 'hand') this.lowerHand(student.persona.id);
        if (student.state === 'confused' || student.state === 'working') student.state = 'idle';
      }
      this.emitStates();
    }

    return intentResult;
  }

  private handleQuestion(text: string, intentResult: TeacherIntentResult, intent: TeacherIntent) {
    const scenario = this.config.scenario;
    const scenarioActive =
      scenario &&
      CONCEPTUAL_SCENARIOS.includes(scenario) &&
      (this.scenarioUses === 0 || this.rng() < 0.35);
    if (scenarioActive && scenario) this.scenarioUses += 1;

    if (scenario === 'many_hands' && scenarioActive) {
      const candidates = this.getStudents()
        .filter((student) => student.participationStyle !== 'shy')
        .slice(0, 5);
      candidates.forEach((student, index) => {
        this.enqueue(index * 0.25, () => this.raiseHand(student.id));
      });
    }

    if (scenario === 'silent_student' && scenarioActive) {
      const shy = this.pickResponder({ styles: ['shy', 'support'] });
      if (shy) {
        this.setStudentState(shy.persona.id, 'thinking');
        this.enqueue(10, () => {
          this.emitStudentEvent({
            student: shy,
            eventType: 'NEED_HELP',
            text: 'Thưa cô… em chưa dám giơ tay ạ. Cô cho em thử lại được không ạ?',
            quality: 'neutral',
            intent,
            confidence: 0.72,
            source: 'local_rules',
          });
          this.restoreState(shy.persona.id);
        });
        return;
      }
    }

    if (scenario === 'not_understanding' && scenarioActive) {
      const support = this.pickResponder({ styles: ['support', 'shy', 'support'] });
      if (support) {
        this.enqueue(2.8, () => {
          this.emitStudentEvent({
            student: support,
            eventType: 'NEED_HELP',
            text: 'Thưa cô, em chưa hiểu chỗ này ạ. Cô có thể nói chậm lại hoặc cho em một ví dụ không ạ?',
            quality: 'neutral',
            intent,
            confidence: 0.8,
            source: 'local_rules',
          });
          this.restoreState(support.persona.id);
        });
        return;
      }
    }

    if (scenario === 'off_topic_question' && scenarioActive) {
      const curious = this.pickResponder({ styles: ['curious', 'active'] });
      if (curious) {
        this.enqueue(2.6, () => {
          this.emitStudentEvent({
            student: curious,
            eventType: 'ASK_QUESTION',
            text: 'Cô ơi, vì sao lá cây lại có màu xanh mà không phải màu đỏ ạ?',
            quality: 'neutral',
            intent,
            confidence: 0.7,
            source: 'local_rules',
          });
          this.restoreState(curious.persona.id);
        });
      }
    }

    const forcedQuality: AnswerQuality | undefined = scenario === 'wrong_answer' && scenarioActive ? 'incorrect' : undefined;
    const responder = this.pickResponder({
      styles: forcedQuality ? ['support', 'shy'] : undefined,
      preferSpoken: false,
    });
    if (!responder) return;

    const second =
      !forcedQuality && intentResult.question?.openEnded && this.rng() < 0.32
        ? this.pickResponder({ exclude: [responder.persona.id] })
        : null;

    this.enqueue(1.3, async () => {
      this.setStudentState(responder.persona.id, 'thinking');
      await this.speak(responder.persona.id, text, intent, 0.84, forcedQuality);
    });

    if (scenario === 'debate' && scenarioActive) {
      const other = second ?? this.pickResponder({ exclude: [responder.persona.id] });
      if (other) {
        this.enqueue(5.2, async () => {
          this.emitStudentEvent({
            student: other,
            eventType: 'ASK_QUESTION',
            text: 'Thưa cô, em nghĩ kết quả khác bạn ạ. Có phải vì mình cộng sai số hạng không ạ? Cô giải thích giúp chúng em với ạ.',
            quality: 'partial',
            intent,
            confidence: 0.74,
            source: 'local_rules',
          });
          this.restoreState(other.persona.id);
        });
      }
    } else if (second) {
      this.enqueue(5.6, async () => {
        this.setStudentState(second.persona.id, 'thinking');
        await this.speak(second.persona.id, text, intent, 0.8);
      });
    }

    if (forcedQuality) {
      // one additional partial answer makes the scenario less predictable
      if (this.rng() < 0.25) {
        const extra = this.pickResponder({ exclude: [responder.persona.id] });
        if (extra) {
          this.enqueue(6.4, () => this.speak(extra.persona.id, text, intent, 0.7));
        }
      }
    }
  }

  private handleInstruction(text: string, intent: TeacherIntent) {
    const scenario = this.config.scenario;
    if (scenario === 'exercise_mistake' && this.scenarioUses === 0 && intent === 'exercise') {
      this.scenarioUses += 1;
      const support = this.pickResponder({ styles: ['support', 'shy'] });
      if (support) {
        this.enqueue(3.8, () => {
          this.emitStudentEvent({
            student: support,
            eventType: 'WRONG_ANSWER',
            text: 'Cô ơi, bài 2 em làm ra 15 nhưng bạn bên cạnh bảo là 18 ạ. Em không biết ai đúng ạ.',
            quality: 'incorrect',
            intent,
            confidence: 0.8,
            source: 'local_rules',
          });
          this.restoreState(support.persona.id);
        });
        return;
      }
    }

    const speaker = this.pickResponder({ styles: intent === 'exercise' ? ['active', 'high_achiever'] : undefined });
    if (!speaker) return;
    const probability = intent === 'exercise' ? 0.55 : 0.3;
    if (this.rng() > probability) return;
    this.enqueue(intent === 'exercise' ? 3.4 : 2.2, async () => {
      await this.speak(speaker.persona.id, text, intent, 0.7);
    });
  }

  /* --------------------------- turn helpers --------------------------- */

  private async speak(
    studentId: string,
    teacherText: string,
    intent: TeacherIntent,
    confidence: number,
    forcedQuality?: AnswerQuality,
  ) {
    if (this.paused || this.stopped) return;
    const runtime = this.students.get(studentId);
    if (!runtime) return;
    this.speakingId = studentId;
    runtime.state = 'speaking';
    this.emitStates();
    try {
      const output = await this.provider.generateStudentResponse({
        lesson: this.lesson,
        phase: this.lesson.lessonPhases.find((phase) => phase.id === this.tracker.getCurrentPhaseId()) ?? null,
        student: runtime.persona,
        teacherText,
        intent,
        difficulty: this.config.difficulty,
        recentTurns: this.recentTurns.slice(-6),
        forcedQuality,
        scenario: this.config.scenario,
        presentation: this.presentationContext,
      });
      if (this.stopped) return;
      const eventType: ClassroomEventType = output.eventType;
      this.emitStudentEvent({
        student: runtime,
        eventType,
        text: output.text.replace(/\*\*/g, '').replace(/^"|"$/g, ''),
        quality: output.quality,
        intent,
        confidence: Math.max(0.5, Math.min(confidence, output.confidence)),
        source: output.source,
      });
      runtime.hasSpoken = true;
      runtime.speakCount += 1;
      if (output.quality === 'correct') {
        runtime.mastery = Math.min(0.99, runtime.mastery + 0.005);
      }
      const words = output.text.split(/\s+/).length;
      const speakingMs = Math.min(6000, Math.max(1800, words * 260));
      this.enqueue(speakingMs / 1000, () => {
        if (this.stopped) return;
        this.speakingId = null;
        if (runtime.state === 'speaking') runtime.state = 'idle';
        this.emitStates();
      });
    } catch (error) {
      console.warn('[Teacher Coach AI] Student response failed:', error);
      this.speakingId = null;
      runtime.state = 'confused';
      this.emitStates();
    }
  }

  private emitStudentEvent(input: {
    student: RuntimeStudent;
    eventType: ClassroomEventType;
    text: string;
    quality: AnswerQuality;
    intent: TeacherIntent;
    confidence: number;
    source: 'local_rules' | 'gemini' | 'manual';
  }) {
    if (this.stopped) return;
    const timestamp = Math.max(0, this.clock());
    const event: ClassroomEvent = {
      id: uid('event'),
      sessionId: this.config.sessionId,
      timestamp,
      lessonPhaseId: this.tracker.getCurrentPhaseId() ?? undefined,
      studentId: input.student.persona.id,
      studentName: input.student.persona.name,
      eventType: input.eventType,
      inputContext: this.pendingQuestion ?? undefined,
      response: input.text,
      confidence: input.confidence,
      quality: input.quality,
      source: input.source,
      intent: input.intent,
    };
    this.history.push(event);
    this.lastSpeakerId = input.student.persona.id;
    this.recentTurns.push({ speaker: 'student', text: `${input.student.persona.name}: ${input.text}` });
    if (this.recentTurns.length > 20) this.recentTurns.shift();
    if (input.eventType === 'ASK_QUESTION' || input.eventType === 'ANSWER_QUESTION' || input.eventType === 'WRONG_ANSWER' || input.eventType === 'NEED_HELP') {
      this.pendingQuestion = null;
      this.setStudentState(input.student.persona.id, 'speaking');
    }
    this.callbacks.onEvent(event);
  }

  private enqueue(delaySec: number, run: () => Promise<void> | void) {
    this.queue.push({ id: uid('turn'), due: this.clock() + Math.max(0, delaySec), run });
  }

  private async processQueue() {
    if (this.turnBusy || this.paused || this.stopped) return;
    const current = this.clock();
    const next = [...this.queue].filter((item) => item.due <= current).sort((a, b) => a.due - b.due)[0];
    if (!next) return;
    this.turnBusy = true;
    this.queue = this.queue.filter((item) => item.id !== next.id);
    try {
      await next.run();
    } catch (error) {
      console.warn('[Teacher Coach AI] Queued turn failed:', error);
    } finally {
      this.turnBusy = false;
    }
  }

  private pickResponder(options: {
    styles?: StudentPersona['participationStyle'][];
    exclude?: string[];
    preferSpoken?: boolean;
  } = {}): RuntimeStudent | null {
    const candidates: Array<{ student: RuntimeStudent; weight: number }> = [];
    const activityFactor = 0.55 + (this.config.studentActivity / 100) * 0.9;
    const difficultyFactor =
      this.config.difficulty === 'hard' ? 1.15 : this.config.difficulty === 'easy' ? 0.85 : 1;
    for (const student of this.students.values()) {
      if (options.exclude?.includes(student.persona.id)) continue;
      if (options.styles?.length && !options.styles.includes(student.persona.participationStyle)) continue;
      if (student.state === 'speaking') continue;
      let weight = STYLE_WEIGHT[student.persona.participationStyle] * activityFactor;
      weight *= student.persona.behaviorRules.answersWhenCalled ? 1 : 0.35;
      weight *= options.preferSpoken === false ? 1 : student.persona.participationRate + 0.2;
      if (student.persona.participationStyle === 'shy' && this.config.difficulty === 'hard') weight *= 0.7;
      if (student.persona.participationStyle === 'support' && this.config.difficulty === 'hard') weight *= 1.2;
      weight *= difficultyFactor;
      if (student.persona.id === this.lastSpeakerId) weight *= 0.45;
      if (student.handRaisedAt !== undefined) weight *= 2.4;
      if (student.persona.behaviorRules.needsEncouragement && student.speakCount === 0) weight *= 0.75;
      candidates.push({ student, weight: Math.max(0.01, weight) });
    }
    if (!candidates.length) return null;
    const total = candidates.reduce((sum, entry) => sum + entry.weight, 0);
    let threshold = this.rng() * total;
    for (const entry of candidates) {
      threshold -= entry.weight;
      if (threshold <= 0) return entry.student;
    }
    return candidates[candidates.length - 1].student;
  }

  private pickDistractedStudent(): RuntimeStudent | null {
    const candidates = Array.from(this.students.values()).filter(
      (student) => student.persona.participationStyle === 'distracted' || student.persona.participationStyle === 'support',
    );
    if (!candidates.length) return null;
    return candidates[Math.floor(this.rng() * candidates.length)];
  }

  private raiseRandomHands(now: number) {
    if (this.config.mode === 'focused') return;
    const alreadyRaised = this.getRaisedHands().length;
    if (alreadyRaised >= 3) return;
    const candidates = Array.from(this.students.values()).filter((student) => {
      if (student.handRaisedAt !== undefined) return false;
      if (student.persona.behaviorRules.handRaiseProbability <= 0) return false;
      return this.rng() < student.persona.behaviorRules.handRaiseProbability * (0.35 + this.config.studentActivity / 130);
    });
    if (!candidates.length) return;
    const chosen = candidates[Math.floor(this.rng() * candidates.length)];
    this.raiseHand(chosen.persona.id);
  }

  private raiseHand(studentId: string) {
    const student = this.students.get(studentId);
    if (!student || student.state === 'speaking') return;
    if (student.handRaisedAt !== undefined) return;
    student.handRaisedAt = this.clock();
    student.state = 'hand';
    this.emitStates();
    this.callbacks.onRaisedHands?.(this.getRaisedHands());
    const event: ClassroomEvent = {
      id: uid('event'),
      sessionId: this.config.sessionId,
      timestamp: Math.max(0, this.clock()),
      lessonPhaseId: this.tracker.getCurrentPhaseId() ?? undefined,
      studentId,
      studentName: student.persona.name,
      eventType: 'RAISE_HAND',
      response: '',
      confidence: 0.9,
      quality: 'neutral',
      source: 'local_rules',
      intent: this.pendingIntent ?? 'unknown',
    };
    this.callbacks.onEvent(event);
  }

  private lowerHand(studentId: string) {
    const student = this.students.get(studentId);
    if (!student) return;
    student.handRaisedAt = undefined;
    if (student.state === 'hand') student.state = 'idle';
    this.emitStates();
    this.callbacks.onRaisedHands?.(this.getRaisedHands());
  }

  private dropStaleHands(now: number) {
    let changed = false;
    for (const student of this.students.values()) {
      if (student.handRaisedAt !== undefined && now - student.handRaisedAt > HAND_TIMEOUT_SEC) {
        student.handRaisedAt = undefined;
        if (student.state === 'hand') student.state = 'idle';
        changed = true;
      }
    }
    if (changed) {
      this.emitStates();
      this.callbacks.onRaisedHands?.(this.getRaisedHands());
    }
  }

  private setStudentState(studentId: string, state: StudentAvatarState, _reason?: string) {
    const student = this.students.get(studentId);
    if (!student) return;
    student.state = state;
    this.emitStates();
  }

  private restoreState(studentId: string) {
    const student = this.students.get(studentId);
    if (!student) return;
    student.state = student.handRaisedAt ? 'hand' : 'idle';
    this.emitStates();
  }

  private setStudentStateAll(exclude: string | undefined, state: StudentAvatarState) {
    for (const student of this.students.values()) {
      if (student.persona.id === exclude) continue;
      if (student.state === 'idle' || student.state === 'hand') student.state = state === 'thinking' ? 'idle' : state;
    }
    this.emitStates();
  }

  private emitStates() {
    const states: Record<string, StudentAvatarState> = {};
    for (const [id, student] of this.students.entries()) {
      let state = student.state;
      if (id === this.speakingId) state = 'speaking';
      states[id] = state;
    }
    this.callbacks.onStates(states);
  }

  private spontaneousInterval(): number {
    const activity = Math.max(0, Math.min(100, this.config.studentActivity));
    const base = 26 - (activity / 100) * 17;
    const jitter = this.rng() * 10;
    return Math.max(6, base + jitter);
  }

  /* --------------------------- manual call --------------------------- */

  callStudent(personaId: string) {
    const student = this.students.get(personaId);
    if (!student || this.stopped) return;
    this.lowerHand(personaId);
    this.setStudentState(personaId, 'thinking');
    const question = this.pendingQuestion;
    this.enqueue(0.5, async () => {
      if (question) {
        await this.speak(personaId, question, 'question', 0.85);
      } else {
        this.emitStudentEvent({
          student,
          eventType: 'PARTICIPATE_IN_ACTIVITY',
          text: 'Dạ, em nghe ạ. Cô muốn em trả lời câu hỏi nào ạ?',
          quality: 'neutral',
          intent: 'call_student',
          confidence: 0.7,
          source: 'local_rules',
        });
        this.restoreState(personaId);
      }
    });
  }
}
