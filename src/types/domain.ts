/**
 * Domain models for Teacher Coach AI.
 * All timestamps are ISO-8601 strings; in-session timestamps (on
 * observations/transcripts/events) are seconds elapsed since session start.
 */

export type ID = string;

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export interface UserProfile {
  id: ID;
  displayName: string;
  avatarDataUrl?: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Lesson plan                                                         */
/* ------------------------------------------------------------------ */

export type LessonFileType = 'pdf' | 'docx' | 'txt';
export type ParsingStatus = 'pending' | 'parsing' | 'needs_review' | 'confirmed' | 'failed';
export type LessonPhaseType =
  | 'warmup'
  | 'exploration'
  | 'knowledge'
  | 'practice'
  | 'application'
  | 'consolidation'
  | 'other';

export type IssueSeverity = 'info' | 'warning' | 'error';

export interface ParsingIssue {
  code: string;
  message: string;
  severity: IssueSeverity;
}

export interface LessonObjective {
  id: ID;
  text: string;
  confidence: number;
  needsReview: boolean;
}

export interface LessonPhase {
  id: ID;
  order: number;
  name: string;
  type: LessonPhaseType;
  objective: string;
  teacherActions: string[];
  studentActions: string[];
  materials: string[];
  questions: string[];
  expectedResponses: string[];
  completionCriteria: string[];
  estimatedDurationMin: number;
  confidence: number;
  needsReview: boolean;
  sourceExcerpt?: string;
}

export interface LessonExercise {
  id: ID;
  prompt: string;
  expectedAnswer: string;
  confidence: number;
  needsReview: boolean;
}

export interface LessonPlan {
  id: ID;
  title: string;
  subject: string;
  grade: number;
  topic: string;
  fileName: string;
  fileType: LessonFileType;
  fileSize: number;
  extractedText: string;
  objectives: LessonObjective[];
  prerequisiteKnowledge: string[];
  coreKnowledge: string[];
  teachingMaterials: string[];
  lessonPhases: LessonPhase[];
  exercises: LessonExercise[];
  expectedStudentResponses: string[];
  assessmentCriteria: string[];
  parsingStatus: ParsingStatus;
  parsingIssues: ParsingIssue[];
  confidence: number;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  isDemo?: boolean;
}

export interface LessonAnalysisResult {
  lesson: LessonPlan;
  warnings: ParsingIssue[];
}

/* ------------------------------------------------------------------ */
/* Presentation (local PPTX)                                           */
/* ------------------------------------------------------------------ */

/**
 * How the slide stage shares space with the camera during a live lesson:
 * - slide_main: slide as the main stage, camera as a small picture-in-picture
 * - tabs: switch between a camera tab and a slide tab
 * - side: camera remains the main stage, slides sit in the right column
 * - window: slides are shown in a separate presentation window
 */
export type PresentationLayout = 'slide_main' | 'tabs' | 'side' | 'window';

/**
 * An image extracted from the PPTX package and kept in IndexedDB. The original
 * .pptx file is never stored: only the data required to render the slides.
 */
export interface PresentationAsset {
  id: string;
  /** Original path inside the PPTX package, used for deduplication/diagnostics. */
  partPath: string;
  mimeType: string;
  size: number;
  blob: Blob;
}

export interface SlideTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontSizePt?: number;
  fontFamily?: string;
}

export interface SlideParagraph {
  runs: SlideTextRun[];
  align?: 'left' | 'center' | 'right' | 'justify';
  /** 0-based paragraph level, used for indentation. */
  level?: number;
  bullet?: boolean;
}

export interface SlideTextElement {
  kind: 'text';
  id: string;
  /** All coordinates are normalised to 0..1 of the slide width/height. */
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDeg?: number;
  paragraphs: SlideParagraph[];
  fill?: string;
  borderColor?: string;
  borderWidthPt?: number;
  anchor?: 'top' | 'middle' | 'bottom';
  insetLeftPt?: number;
  insetRightPt?: number;
  insetTopPt?: number;
  insetBottomPt?: number;
  /** PowerPoint placeholder type, e.g. title, ctrTitle, body, subTitle. */
  placeholderType?: string;
  preset?: string;
}

export interface SlideImageCrop {
  /** Fractions of the source image cropped from each edge (0..1). */
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SlideImageElement {
  kind: 'image';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDeg?: number;
  assetId: string;
  crop?: SlideImageCrop;
  alt?: string;
}

export interface SlideTableCell {
  text: string;
  bold?: boolean;
}

export interface SlideTableElement {
  kind: 'table';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rows: SlideTableCell[][];
  /** Relative column widths (sum = 1). */
  columnWidths: number[];
  /** Relative row heights (sum = 1), when the file provides them. */
  rowHeights?: number[];
}

export type SlideElement = SlideTextElement | SlideImageElement | SlideTableElement;

export interface SlideBackground {
  color?: string;
  assetId?: string;
}

export interface PresentationSlide {
  id: string;
  index: number;
  title: string;
  /** Plain text extracted for display and for the AI student context. */
  text: string;
  background: SlideBackground;
  elements: SlideElement[];
  /**
   * Optional full-slide image rendered from a PDF exported out of PowerPoint.
   * When present it is shown instead of the approximate HTML reconstruction.
   */
  visualAssetId?: string;
}

/** How the slide stage is drawn: reconstructed from PPTX or a PDF page image. */
export type PresentationVisualMode = 'html' | 'pdf';

/**
 * Extracted slide data stored locally. `fileName`/`fileSize` are metadata; the
 * original PPTX bytes are deliberately not kept.
 */
export interface PresentationDoc {
  id: ID;
  lessonPlanId: ID;
  fileName: string;
  fileSize: number;
  slideWidthEmu: number;
  slideHeightEmu: number;
  slides: PresentationSlide[];
  assets: PresentationAsset[];
  warnings: ParsingIssue[];
  /**
   * `pdf` when the teacher attached a PDF exported from the same PPTX. Only
   * page images are kept, not the PDF file itself.
   */
  visualMode?: PresentationVisualMode;
  visualFileName?: string;
  visualPageCount?: number;
  visualWarnings?: ParsingIssue[];
  createdAt: string;
  updatedAt: string;
}

/** Extracted presentation data before it is attached to a lesson plan. */
export type PresentationDraft = Pick<
  PresentationDoc,
  'fileName' | 'fileSize' | 'slideWidthEmu' | 'slideHeightEmu' | 'slides' | 'assets' | 'warnings'
>;

/** Compact context sent to local rules/Gemini: current slide + title outline. */
export interface PresentationContext {
  slideNumber: number;
  totalSlides: number;
  title: string;
  text: string;
  outline: string[];
}

/* ------------------------------------------------------------------ */
/* Student personas                                                    */
/* ------------------------------------------------------------------ */

export type LearningLevel = 'needs_support' | 'developing' | 'proficient' | 'advanced';
export type ParticipationStyle =
  | 'active'
  | 'shy'
  | 'support'
  | 'curious'
  | 'distracted'
  | 'high_achiever';

export interface StudentResponseStyle {
  sentenceLength: 'short' | 'medium' | 'long';
  usesHesitation: boolean;
  confidenceTone: 'timid' | 'neutral' | 'eager';
  commonPhrases: string[];
}

export interface StudentBehaviorRules {
  handRaiseProbability: number;
  distractionProbability: number;
  needsEncouragement: boolean;
  answersWhenCalled: boolean;
  speaksWithoutPrompt: boolean;
}

export interface StudentPersona {
  id: ID;
  name: string;
  avatarSeed: number;
  color: string;
  grade: number;
  learningLevel: LearningLevel;
  participationStyle: ParticipationStyle;
  /** Topic-key -> mastery (0..1), persisted per student where relevant. */
  knowledgeState: Record<string, number>;
  misconceptionProfile: string[];
  responseStyle: StudentResponseStyle;
  behaviorRules: StudentBehaviorRules;
  participationRate: number;
  notes?: string;
  isDemo?: boolean;
}

export type StudentAvatarState =
  | 'idle'
  | 'hand'
  | 'speaking'
  | 'thinking'
  | 'confused'
  | 'working';

export interface StudentRuntimeState {
  persona: StudentPersona;
  avatarState: StudentAvatarState;
  mastery: number;
  hasSpoken: boolean;
  lastEventAt?: number;
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export type SessionMode = 'natural' | 'scenario' | 'focused';
export type SessionStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'active'
  | 'paused'
  | 'completed'
  | 'error';

export type ScenarioType =
  | 'wrong_answer'
  | 'not_understanding'
  | 'distracted'
  | 'silent_student'
  | 'off_topic_question'
  | 'many_hands'
  | 'exercise_mistake'
  | 'debate';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type FeedbackFrequency = 'low' | 'normal' | 'high';

export interface SessionSettings {
  mode: SessionMode;
  scenario?: ScenarioType;
  studentCount: number;
  difficulty: Difficulty;
  studentActivity: number;
  feedbackFrequency: FeedbackFrequency;
  recordingEnabled: boolean;
  cameraDeviceId?: string;
  microDeviceId?: string;
  initialPhaseId?: string;
  focusedExerciseId?: string;
}

export interface PracticeSession {
  id: ID;
  lessonPlanId: ID;
  lessonTitle: string;
  mode: SessionMode;
  startedAt: string;
  endedAt?: string;
  durationSec: number;
  status: SessionStatus;
  settings: SessionSettings;
  className?: string;
  reportId?: ID;
  trainingExerciseId?: ID;
  transcriptAvailable: boolean;
  cameraAvailable: boolean;
  poseAvailable: boolean;
  isDemo?: boolean;
  notes?: string;
}

/* ------------------------------------------------------------------ */
/* Observations                                                        */
/* ------------------------------------------------------------------ */

export interface PoseKeypoint {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PostureMetrics {
  visibilityRatio: number;
  centerOffsetX: number;
  centerOffsetY: number;
  shoulderTiltDeg: number;
  stability: number;
  movementIntensity: number;
  wristAboveShoulderRatio: number;
  brightness?: number;
}

export interface PoseObservation {
  id: ID;
  sessionId: ID;
  kind: 'pose';
  timestamp: number;
  keypoints: PoseKeypoint[];
  postureMetrics: PostureMetrics;
  confidence: number;
}

export interface AudioObservation {
  id: ID;
  sessionId: ID;
  kind: 'audio';
  timestamp: number;
  volumeDb: number;
  speechActivity: boolean;
  pauseDurationSec: number;
  estimatedSpeakingRate?: number;
  confidence: number;
}

export type ObservationRecord = PoseObservation | AudioObservation;

/* ------------------------------------------------------------------ */
/* Transcript                                                          */
/* ------------------------------------------------------------------ */

export type Speaker = 'teacher' | 'student' | 'system';
export type TranscriptSource = 'speech' | 'manual' | 'ai';

export interface TranscriptSegment {
  id: ID;
  sessionId: ID;
  startTime: number;
  endTime: number;
  text: string;
  speaker: Speaker;
  confidence: number;
  source: TranscriptSource;
  studentId?: ID;
}

/* ------------------------------------------------------------------ */
/* Classroom                                                           */
/* ------------------------------------------------------------------ */

export type ClassroomEventType =
  | 'RAISE_HAND'
  | 'ANSWER_QUESTION'
  | 'ASK_QUESTION'
  | 'WRONG_ANSWER'
  | 'INCOMPLETE_ANSWER'
  | 'NEED_HELP'
  | 'DISTRACTED'
  | 'REQUEST_EXPLANATION'
  | 'COMPLETE_EXERCISE'
  | 'PARTICIPATE_IN_ACTIVITY';

export type AnswerQuality = 'correct' | 'partial' | 'incorrect' | 'neutral';
export type TeacherIntent =
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

export interface ClassroomEvent {
  id: ID;
  sessionId: ID;
  timestamp: number;
  lessonPhaseId?: ID;
  studentId: ID;
  studentName: string;
  eventType: ClassroomEventType;
  inputContext?: string;
  response: string;
  confidence: number;
  quality?: AnswerQuality;
  source: 'local_rules' | 'gemini' | 'manual';
  intent?: TeacherIntent;
}

/* ------------------------------------------------------------------ */
/* Feedback & evidence                                                 */
/* ------------------------------------------------------------------ */

export type FeedbackCategory =
  | 'pedagogy'
  | 'voice'
  | 'posture'
  | 'organization'
  | 'interaction'
  | 'presentation';

export type FeedbackSeverity = 'info' | 'suggestion' | 'warning' | 'critical';
export type EvidenceSource = 'transcript' | 'pose' | 'audio' | 'classroom' | 'lesson';

export interface EvidenceItem {
  id: ID;
  timestamp: number;
  source: EvidenceSource;
  observedFact: string;
  interpretation: string;
  confidence: number;
  sessionId?: ID;
}

export interface FeedbackEvent {
  id: ID;
  sessionId: ID;
  timestamp: number;
  category: FeedbackCategory;
  severity: FeedbackSeverity;
  ruleId: string;
  evidence: EvidenceItem;
  explanation: string;
  recommendation: string;
  confidence: number;
  pinned?: boolean;
  dismissed?: boolean;
  helpful?: boolean | null;
  live: boolean;
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export interface CompetencyScore {
  category: FeedbackCategory;
  label: string;
  score: number | null;
  confidence: number;
  evidenceIds: ID[];
  insufficientData: boolean;
  sampleSize: number;
  notes: string;
}

export interface ReportInsight {
  title: string;
  detail: string;
  evidenceIds: ID[];
  category: FeedbackCategory;
}

export interface PhaseProgress {
  phaseId: ID;
  name: string;
  type: LessonPhaseType;
  covered: boolean;
  evidenceTimestamps: number[];
  coverageConfidence: number;
}

export interface SessionMetricsSummary {
  durationSec: number;
  teacherSpeakingSec: number;
  studentSpeakingSec: number;
  speechRatio: number;
  avgVolumeDb: number | null;
  volumeVariabilityDb: number | null;
  pauseCount: number;
  avgPauseSec: number | null;
  longestPauseSec: number;
  wordsPerMinute: number | null;
  questionCount: number;
  openQuestionCount: number;
  closedQuestionCount: number;
  praiseCount: number;
  encouragementCount: number;
  transitionCount: number;
  postureSamples: number;
  postureVisibility: number | null;
  postureStability: number | null;
  gestureRate: number | null;
  handRaiseCount: number;
  answerCount: number;
  wrongAnswerCount: number;
  studentTurns: number;
  phaseCount: number;
  coveredPhaseCount: number;
}

export interface SessionReport {
  id: ID;
  sessionId: ID;
  lessonPlanId: ID;
  lessonTitle: string;
  createdAt: string;
  overallScore: number | null;
  overallConfidence: number;
  competencies: CompetencyScore[];
  strengths: ReportInsight[];
  improvements: ReportInsight[];
  timeline: EvidenceItem[];
  evidence: EvidenceItem[];
  metrics: SessionMetricsSummary;
  phaseProgress: PhaseProgress[];
  recommendations: string[];
  generatedBy: 'rules' | 'gemini';
  /** Optional natural-language summary generated by the server-side Gemini proxy. */
  aiSummary?: {
    summary: string;
    strengths: string[];
    improvements: string[];
    source: 'gemini';
  } | null;
  isDemo?: boolean;
}

/* ------------------------------------------------------------------ */
/* Training center                                                     */
/* ------------------------------------------------------------------ */

export type TrainingGroup =
  | 'voice'
  | 'posture'
  | 'questioning'
  | 'language'
  | 'opening'
  | 'transition'
  | 'situations'
  | 'interaction';

export interface TrainingCriterion {
  id: string;
  label: string;
  metric:
    | 'speaking_ratio'
    | 'volume_stability'
    | 'pause_appropriateness'
    | 'posture_visibility'
    | 'posture_stability'
    | 'gesture_rate'
    | 'question_count'
    | 'open_question_count'
    | 'praise_count'
    | 'encouragement_count'
    | 'student_turns'
    | 'transition_count'
    | 'phase_coverage'
    | 'greeting_detected'
    | 'summary_detected'
    | 'wrong_answer_support'
    | 'duration'
    | 'custom';
  target: number;
  comparison: 'gte' | 'lte' | 'between';
  secondTarget?: number;
  unit: string;
}

export interface TrainingExercise {
  id: string;
  title: string;
  group: TrainingGroup;
  description: string;
  objective: string;
  instructions: string[];
  durationMin: number;
  criteria: TrainingCriterion[];
  usesStudents: boolean;
  scenario?: ScenarioType;
  difficulty: Difficulty;
  isBuiltIn: true;
}

export interface TrainingCriterionResult {
  criterionId: string;
  label: string;
  met: boolean | null;
  observed: number | null;
  target: string;
}

export interface TrainingResult {
  id: ID;
  exerciseId: ID;
  exerciseTitle: string;
  startedAt: string;
  completedAt: string;
  durationSec: number;
  sessionId?: ID;
  score: number | null;
  passed: boolean | null;
  criteriaResults: TrainingCriterionResult[];
  note?: string;
  isDemo?: boolean;
}

/* ------------------------------------------------------------------ */
/* Audio / camera devices                                              */
/* ------------------------------------------------------------------ */

export interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

export interface CameraStatus {
  state: 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error';
  message?: string;
  stream?: MediaStream;
  width?: number;
  height?: number;
  brightness?: number;
}

export interface MicStatus {
  state: 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error';
  message?: string;
  stream?: MediaStream;
  level: number;
  speaking: boolean;
}

/* ------------------------------------------------------------------ */
/* Language analysis                                                   */
/* ------------------------------------------------------------------ */

export interface LanguageAnalysisResult {
  segments: number;
  questionCount: number;
  openQuestionCount: number;
  closedQuestionCount: number;
  probeQuestionCount: number;
  praiseCount: number;
  encouragementCount: number;
  transitionCount: number;
  greetingDetected: boolean;
  summaryDetected: boolean;
  clarityScore: number | null;
  notes: string[];
  confidence: number;
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export interface DemoSeedInfo {
  seededAt: string;
  lessonId: ID;
  sessionId?: ID;
}
