import { db, getMeta, setMeta } from '@/data/db';
import { buildDemoLesson } from '@/data/demo-lesson';
import { buildAllDefaultPersonas } from '@/data/default-personas';
import type { StudentPersona } from '@/types/domain';

export const DEMO_LESSON_ID = 'demo_lesson_bang_nhan_3';
export const DEMO_OPT_OUT_KEY = 'demoOptOut';
export const DEMO_SEEDED_KEY = 'demoSeededAt';

/**
 * Built-in AI student personas are fictional classroom actors, not practice
 * data. They are seeded once and can be edited or deleted by the teacher.
 */
export async function ensureBuiltInPersonas(grade = 2): Promise<number> {
  const existing = await db.students.filter((student) => student.isDemo !== true).count();
  if (existing > 0) return 0;
  const students = buildAllDefaultPersonas(grade, false).map<StudentPersona>((student) => ({
    ...student,
    isDemo: false,
  }));
  await db.students.bulkPut(students);
  return students.length;
}

/**
 * Seeds one clearly-labelled DEMO lesson exactly once. It never creates fake
 * sessions, transcripts, scores or reports. The user can delete it at any time.
 */
export async function seedDemoData(): Promise<{ lessonId: string }> {
  const optedOut = await getMeta<boolean>(DEMO_OPT_OUT_KEY);
  const alreadySeeded = await getMeta<string>(DEMO_SEEDED_KEY);
  const existing = await db.lessons.get(DEMO_LESSON_ID);
  if (optedOut || alreadySeeded || existing) {
    return { lessonId: DEMO_LESSON_ID };
  }
  const lesson = buildDemoLesson();
  await db.transaction('rw', [db.lessons, db.meta], async () => {
    await db.lessons.put(lesson);
    await setMeta(DEMO_SEEDED_KEY, new Date().toISOString());
  });
  return { lessonId: lesson.id };
}

export async function removeDemoData(): Promise<void> {
  await db.transaction('rw', [db.lessons, db.meta], async () => {
    await db.lessons.filter((lesson) => lesson.isDemo === true).delete();
    await setMeta(DEMO_OPT_OUT_KEY, true);
    await db.meta.delete(DEMO_SEEDED_KEY);
  });
}

export async function restoreDemoData(): Promise<void> {
  await db.transaction('rw', [db.lessons, db.meta], async () => {
    await db.meta.delete(DEMO_OPT_OUT_KEY);
    await db.meta.delete(DEMO_SEEDED_KEY);
  });
  await seedDemoData();
}

export async function hasDemoData(): Promise<boolean> {
  const lesson = await db.lessons.get(DEMO_LESSON_ID);
  return Boolean(lesson?.isDemo);
}
