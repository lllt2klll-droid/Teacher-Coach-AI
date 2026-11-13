import { db, getMeta, setMeta } from '@/data/db';
import { uid } from '@/lib/utils';
import { applyPdfVisual, clearPdfVisual, type RenderedPdfVisual } from '@/services/presentation/pdf-visual';
import type {
  ClassroomEvent,
  FeedbackEvent,
  LessonPlan,
  ObservationRecord,
  PracticeSession,
  PresentationDoc,
  PresentationDraft,
  SessionReport,
  StudentPersona,
  TrainingResult,
  TranscriptSegment,
  UserProfile,
} from '@/types/domain';

export const profileRepo = {
  async get(): Promise<UserProfile | undefined> {
    return db.profile.toCollection().first();
  },
  async ensure(): Promise<UserProfile> {
    const existing = await profileRepo.get();
    if (existing) return existing;
    const profile: UserProfile = {
      id: uid('profile'),
      displayName: 'Giáo viên tập sự',
      createdAt: new Date().toISOString(),
    };
    await db.profile.put(profile);
    return profile;
  },
  async save(profile: UserProfile): Promise<void> {
    await db.profile.put(profile);
  },
};

export const lessonRepo = {
  async list(): Promise<LessonPlan[]> {
    return db.lessons.orderBy('updatedAt').reverse().toArray();
  },
  async get(id: string): Promise<LessonPlan | undefined> {
    return db.lessons.get(id);
  },
  async save(lesson: LessonPlan): Promise<void> {
    await db.lessons.put(lesson);
  },
  async remove(id: string): Promise<void> {
    await db.transaction('rw', [db.lessons, db.presentations], async () => {
      await db.lessons.delete(id);
      await db.presentations.where('lessonPlanId').equals(id).delete();
    });
  },
  async duplicate(id: string): Promise<LessonPlan | undefined> {
    const original = await db.lessons.get(id);
    if (!original) return undefined;
    const now = new Date().toISOString();
    const copy: LessonPlan = {
      ...original,
      id: uid('lesson'),
      title: `${original.title} (bản sao)`,
      createdAt: now,
      updatedAt: now,
      confirmedAt: original.confirmedAt,
      isDemo: false,
    };
    await db.lessons.put(copy);
    return copy;
  },
};

export const studentRepo = {
  async list(): Promise<StudentPersona[]> {
    return db.students.toArray();
  },
  async get(id: string): Promise<StudentPersona | undefined> {
    return db.students.get(id);
  },
  async save(student: StudentPersona): Promise<void> {
    await db.students.put(student);
  },
  async saveMany(students: StudentPersona[]): Promise<void> {
    await db.students.bulkPut(students);
  },
  async remove(id: string): Promise<void> {
    await db.students.delete(id);
  },
};

export const sessionRepo = {
  async list(): Promise<PracticeSession[]> {
    return db.sessions.orderBy('startedAt').reverse().toArray();
  },
  async get(id: string): Promise<PracticeSession | undefined> {
    return db.sessions.get(id);
  },
  async save(session: PracticeSession): Promise<void> {
    await db.sessions.put(session);
  },
  async remove(id: string): Promise<void> {
    await db.transaction(
      'rw',
      [db.sessions, db.observations, db.transcripts, db.classroomEvents, db.feedback, db.reports, db.recordings, db.trainingResults],
      async () => {
        await Promise.all([
          db.sessions.delete(id),
          db.observations.where('sessionId').equals(id).delete(),
          db.transcripts.where('sessionId').equals(id).delete(),
          db.classroomEvents.where('sessionId').equals(id).delete(),
          db.feedback.where('sessionId').equals(id).delete(),
          db.reports.where('sessionId').equals(id).delete(),
          db.recordings.delete(id),
          db.trainingResults.where('sessionId').equals(id).delete(),
        ]);
      },
    );
  },
};

export const observationRepo = {
  async bulkSave(rows: ObservationRecord[]): Promise<void> {
    if (!rows.length) return;
    await db.observations.bulkPut(rows);
  },
  async forSession(sessionId: string): Promise<ObservationRecord[]> {
    return db.observations.where('sessionId').equals(sessionId).sortBy('timestamp');
  },
};

export const transcriptRepo = {
  async save(segment: TranscriptSegment): Promise<void> {
    await db.transcripts.put(segment);
  },
  async bulkSave(segments: TranscriptSegment[]): Promise<void> {
    if (!segments.length) return;
    await db.transcripts.bulkPut(segments);
  },
  async forSession(sessionId: string): Promise<TranscriptSegment[]> {
    return db.transcripts.where('sessionId').equals(sessionId).sortBy('startTime');
  },
  async remove(segmentId: string): Promise<void> {
    await db.transcripts.delete(segmentId);
  },
};

export const classroomEventRepo = {
  async save(event: ClassroomEvent): Promise<void> {
    await db.classroomEvents.put(event);
  },
  async forSession(sessionId: string): Promise<ClassroomEvent[]> {
    return db.classroomEvents.where('sessionId').equals(sessionId).sortBy('timestamp');
  },
};

export const feedbackRepo = {
  async saveMany(events: FeedbackEvent[]): Promise<void> {
    if (!events.length) return;
    await db.feedback.bulkPut(events);
  },
  async update(event: FeedbackEvent): Promise<void> {
    await db.feedback.put(event);
  },
  async forSession(sessionId: string): Promise<FeedbackEvent[]> {
    return db.feedback.where('sessionId').equals(sessionId).sortBy('timestamp');
  },
};

export const reportRepo = {
  async list(): Promise<SessionReport[]> {
    return db.reports.orderBy('createdAt').reverse().toArray();
  },
  async get(id: string): Promise<SessionReport | undefined> {
    return db.reports.get(id);
  },
  async forSession(sessionId: string): Promise<SessionReport | undefined> {
    return db.reports.where('sessionId').equals(sessionId).first();
  },
  async save(report: SessionReport): Promise<void> {
    await db.reports.put(report);
  },
  async remove(id: string): Promise<void> {
    await db.reports.delete(id);
  },
};

export const trainingRepo = {
  async list(): Promise<TrainingResult[]> {
    // `createdAt` is not part of TrainingResult; sort real completion time.
    const rows = await db.trainingResults.toArray();
    return rows.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  },
  async save(result: TrainingResult): Promise<void> {
    await db.trainingResults.put(result);
  },
};

export const presentationRepo = {
  async forLesson(lessonPlanId: string): Promise<PresentationDoc | undefined> {
    return db.presentations.where('lessonPlanId').equals(lessonPlanId).first();
  },
  async saveForLesson(lessonPlanId: string, draft: PresentationDraft): Promise<PresentationDoc> {
    const now = new Date().toISOString();
    const existing = await db.presentations.where('lessonPlanId').equals(lessonPlanId).first();
    // A newly parsed PPTX invalidates any previous PDF visual layer: its pages
    // belong to the old file and could show the wrong slide.
    const presentation: PresentationDoc = {
      ...draft,
      slides: draft.slides.map((slide) => ({ ...slide, visualAssetId: undefined })),
      id: existing?.id ?? uid('presentation'),
      lessonPlanId,
      visualMode: 'html',
      visualFileName: undefined,
      visualPageCount: undefined,
      visualWarnings: undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await db.transaction('rw', db.presentations, async () => {
      await db.presentations.put(presentation);
    });
    return presentation;
  },
  /** Stores PDF page images as the faithful visual layer for an existing deck. */
  async attachVisualPdf(lessonPlanId: string, rendered: RenderedPdfVisual): Promise<PresentationDoc> {
    const existing = await db.presentations.where('lessonPlanId').equals(lessonPlanId).first();
    if (!existing) {
      throw new Error('Chưa có bài trình chiếu PPTX. Hãy tải PPTX trước rồi mới đính kèm PDF.');
    }
    const presentation = applyPdfVisual(existing, rendered);
    await db.presentations.put(presentation);
    return presentation;
  },
  async removeVisualPdf(lessonPlanId: string): Promise<PresentationDoc | undefined> {
    const existing = await db.presentations.where('lessonPlanId').equals(lessonPlanId).first();
    if (!existing) return undefined;
    const presentation = clearPdfVisual(existing);
    await db.presentations.put(presentation);
    return presentation;
  },
  async removeForLesson(lessonPlanId: string): Promise<void> {
    await db.presentations.where('lessonPlanId').equals(lessonPlanId).delete();
  },
};

export const recordingRepo = {
  async save(record: { sessionId: string; blob: Blob; mimeType: string }): Promise<void> {
    await db.recordings.put({
      ...record,
      size: record.blob.size,
      createdAt: new Date().toISOString(),
    });
  },
  async get(sessionId: string) {
    return db.recordings.get(sessionId);
  },
  async remove(sessionId: string): Promise<void> {
    await db.recordings.delete(sessionId);
  },
};

export const demoMetaRepo = {
  getSeededAt: () => getMeta<string>('demoSeededAt'),
  setSeededAt: (iso: string) => setMeta('demoSeededAt', iso),
};

export async function deleteAllUserData(): Promise<void> {
  await db.transaction(
    'rw',
    db.tables,
    async () => {
      await Promise.all(db.tables.map((table) => table.clear()));
    },
  );
}

export async function databaseStats(): Promise<{
  lessons: number;
  sessions: number;
  reports: number;
  students: number;
  recordings: number;
  presentations: number;
  storageBytes: number | null;
}> {
  const [lessons, sessions, reports, students, recordings, presentations] = await Promise.all([
    db.lessons.count(),
    db.sessions.count(),
    db.reports.count(),
    db.students.count(),
    db.recordings.count(),
    db.presentations.count(),
  ]);
  let storageBytes: number | null = null;
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    storageBytes = estimate.usage ?? null;
  }
  return { lessons, sessions, reports, students, recordings, presentations, storageBytes };
}
