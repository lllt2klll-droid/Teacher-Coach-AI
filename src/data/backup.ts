import { db, SCHEMA_VERSION } from '@/data/db';
import type {
  ClassroomEvent,
  FeedbackEvent,
  LessonPlan,
  ObservationRecord,
  PracticeSession,
  SessionReport,
  StudentPersona,
  TrainingResult,
  TranscriptSegment,
  UserProfile,
} from '@/types/domain';

export const APP_VERSION = '0.2.0';
export const BACKUP_FORMAT = 'teacher-coach-ai-backup';

export interface BackupData {
  profile: UserProfile[];
  lessons: LessonPlan[];
  students: StudentPersona[];
  sessions: PracticeSession[];
  observations: ObservationRecord[];
  transcripts: TranscriptSegment[];
  classroomEvents: ClassroomEvent[];
  feedback: FeedbackEvent[];
  reports: SessionReport[];
  trainingResults: TrainingResult[];
}

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  counts: Record<string, number>;
  data: BackupData;
  note: string;
}

const TABLE_KEYS: Array<keyof BackupData> = [
  'profile',
  'lessons',
  'students',
  'sessions',
  'observations',
  'transcripts',
  'classroomEvents',
  'feedback',
  'reports',
  'trainingResults',
];

export async function createBackup(): Promise<BackupEnvelope> {
  const [profile, lessons, students, sessions, observations, transcripts, classroomEvents, feedback, reports, trainingResults] =
    await Promise.all([
      db.profile.toArray(),
      db.lessons.toArray(),
      db.students.toArray(),
      db.sessions.toArray(),
      db.observations.toArray(),
      db.transcripts.toArray(),
      db.classroomEvents.toArray(),
      db.feedback.toArray(),
      db.reports.toArray(),
      db.trainingResults.toArray(),
    ]);
  const data: BackupData = {
    profile,
    lessons,
    students,
    sessions,
    observations,
    transcripts,
    classroomEvents,
    feedback,
    reports,
    trainingResults,
  };
  const counts = Object.fromEntries(TABLE_KEYS.map((key) => [key, data[key].length]));
  return {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    counts,
    data,
    note: 'Bản sao lưu không bao gồm video ghi hình (nếu có) và dữ liệu bài trình chiếu PPTX đã trích xuất. Dữ liệu được lưu cục bộ trên thiết bị.',
  };
}

export function downloadBackup(backup: BackupEnvelope): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `teacher-coach-ai-backup-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  backup?: BackupEnvelope;
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function validateBackup(raw: unknown): BackupValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['File không phải JSON hợp lệ.'], warnings };
  }
  const envelope = raw as Partial<BackupEnvelope>;
  if (envelope.format !== BACKUP_FORMAT) {
    return {
      valid: false,
      errors: ['Đây không phải file sao lưu của Teacher Coach AI (sai định dạng).'],
      warnings,
    };
  }
  if (typeof envelope.schemaVersion !== 'number' || envelope.schemaVersion < 1) {
    errors.push('Thiếu phiên bản schema hợp lệ.');
  } else if (envelope.schemaVersion > SCHEMA_VERSION) {
    errors.push(
      `File sao lưu được tạo bởi phiên bản mới hơn (schema ${envelope.schemaVersion}). Hãy cập nhật ứng dụng trước khi nhập.`,
    );
  } else if (envelope.schemaVersion < SCHEMA_VERSION) {
    warnings.push('Bản sao lưu dùng schema cũ; dữ liệu sẽ được chuyển đổi tối thiểu khi nhập.');
  }
  if (!envelope.data || typeof envelope.data !== 'object') {
    errors.push('File sao lưu thiếu phần dữ liệu.');
    return { valid: false, errors, warnings };
  }
  for (const key of TABLE_KEYS) {
    if (!isArray(envelope.data[key])) {
      errors.push(`Thiếu bảng dữ liệu “${key}”.`);
    }
  }
  if (!errors.length) {
    const lessons = envelope.data.lessons as unknown[];
    for (const [index, lesson] of lessons.entries()) {
      const candidate = lesson as Partial<LessonPlan>;
      if (!candidate.id || !candidate.title) {
        errors.push(`Kế hoạch bài dạy thứ ${index + 1} thiếu id hoặc tiêu đề.`);
      }
      if (candidate.lessonPhases && !Array.isArray(candidate.lessonPhases)) {
        errors.push(`Kế hoạch bài dạy “${candidate.title ?? index + 1}” có trường hoạt động không hợp lệ.`);
      }
    }
    const sessions = envelope.data.sessions as unknown[];
    for (const [index, session] of sessions.entries()) {
      const candidate = session as Partial<PracticeSession>;
      if (!candidate.id || !candidate.startedAt) {
        errors.push(`Buổi luyện tập thứ ${index + 1} thiếu id hoặc thời điểm bắt đầu.`);
      }
    }
    if ((envelope.data.reports as unknown[]).length && !(envelope.data.sessions as unknown[]).length) {
      warnings.push('File có báo cáo nhưng không có buổi luyện tập tương ứng; một số liên kết có thể bị thiếu.');
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    backup: errors.length === 0 ? (raw as BackupEnvelope) : undefined,
  };
}

export async function readBackupFile(file: File): Promise<BackupValidationResult> {
  if (file.size > 80 * 1024 * 1024) {
    return { valid: false, errors: ['File sao lưu vượt quá 80MB.'], warnings: [] };
  }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    return validateBackup(parsed);
  } catch (error) {
    return {
      valid: false,
      errors: [`Không đọc được JSON: ${error instanceof Error ? error.message : 'lỗi không xác định'}`],
      warnings: [],
    };
  }
}

export async function importBackup(
  backup: BackupEnvelope,
  mode: 'replace' | 'merge' = 'replace',
): Promise<Record<string, number>> {
  const validation = validateBackup(backup);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }
  const tablesInUse = [db.profile, db.lessons, db.students, db.sessions, db.observations, db.transcripts, db.classroomEvents, db.feedback, db.reports, db.trainingResults];
  await db.transaction('rw', tablesInUse, async () => {
    if (mode === 'replace') {
      for (const table of tablesInUse) await table.clear();
    }
    await db.profile.bulkPut(backup.data.profile);
    await db.lessons.bulkPut(backup.data.lessons);
    await db.students.bulkPut(backup.data.students);
    await db.sessions.bulkPut(backup.data.sessions);
    await db.observations.bulkPut(backup.data.observations);
    await db.transcripts.bulkPut(backup.data.transcripts);
    await db.classroomEvents.bulkPut(backup.data.classroomEvents);
    await db.feedback.bulkPut(backup.data.feedback);
    await db.reports.bulkPut(backup.data.reports);
    await db.trainingResults.bulkPut(backup.data.trainingResults);
  });
  return Object.fromEntries(TABLE_KEYS.map((key) => [key, backup.data[key].length]));
}
