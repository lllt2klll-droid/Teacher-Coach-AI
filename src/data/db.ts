import Dexie, { type Table } from 'dexie';
import type {
  AudioObservation,
  ClassroomEvent,
  FeedbackEvent,
  LessonPlan,
  ObservationRecord,
  PoseObservation,
  PracticeSession,
  PresentationDoc,
  SessionReport,
  StudentPersona,
  TrainingResult,
  TranscriptSegment,
  UserProfile,
} from '@/types/domain';

export interface RecordingRecord {
  sessionId: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: string;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

export class TeacherCoachDatabase extends Dexie {
  profile!: Table<UserProfile, string>;
  lessons!: Table<LessonPlan, string>;
  students!: Table<StudentPersona, string>;
  sessions!: Table<PracticeSession, string>;
  observations!: Table<ObservationRecord, string>;
  transcripts!: Table<TranscriptSegment, string>;
  classroomEvents!: Table<ClassroomEvent, string>;
  feedback!: Table<FeedbackEvent, string>;
  reports!: Table<SessionReport, string>;
  trainingResults!: Table<TrainingResult, string>;
  recordings!: Table<RecordingRecord, string>;
  presentations!: Table<PresentationDoc, string>;
  meta!: Table<MetaRecord, string>;

  constructor() {
    super('teacher-coach-ai');
    this.version(1).stores({
      profile: 'id',
      lessons: 'id, updatedAt, parsingStatus, subject, grade, isDemo',
      students: 'id, isDemo, name',
      sessions: 'id, startedAt, status, lessonPlanId, isDemo',
      observations: 'id, sessionId, kind, timestamp, [sessionId+kind], [sessionId+timestamp]',
      transcripts: 'id, sessionId, startTime, [sessionId+startTime]',
      classroomEvents: 'id, sessionId, timestamp, [sessionId+timestamp]',
      feedback: 'id, sessionId, timestamp, [sessionId+timestamp]',
      reports: 'id, sessionId, createdAt, lessonPlanId, isDemo',
      trainingResults: 'id, exerciseId, createdAt',
      recordings: 'sessionId',
      meta: 'key',
    });
    // v2: index training results by session so deleting a session also
    // removes its training result, and index real completion time.
    this.version(2).stores({
      trainingResults: 'id, exerciseId, sessionId, completedAt',
    });
    // v3: one locally extracted presentation per lesson plan. Original PPTX
    // bytes are never stored; assets are blobs of the images used in slides.
    this.version(3).stores({
      presentations: 'id, &lessonPlanId, updatedAt',
    });
  }
}

export const db = new TeacherCoachDatabase();

export type PoseObservationRow = PoseObservation;
export type AudioObservationRow = AudioObservation;

export const SCHEMA_VERSION = 3;

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const record = await db.meta.get(key);
  return record?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
