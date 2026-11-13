import { ensureBuiltInPersonas, seedDemoData } from '@/data/seed';
import { profileRepo } from '@/data/repositories';

let bootPromise: Promise<void> | null = null;

/**
 * Local-first bootstrap: opens the IndexedDB database, guarantees a profile,
 * seeds the fictional student personas and one clearly-labelled DEMO lesson.
 * It never seeds fake practice sessions, transcripts or reports.
 */
export async function bootstrapApp(): Promise<void> {
  await profileRepo.ensure();
  await ensureBuiltInPersonas();
  await seedDemoData();
}

export function bootstrapOnce(): Promise<void> {
  if (!bootPromise) {
    bootPromise = bootstrapApp().catch((error) => {
      bootPromise = null;
      throw error;
    });
  }
  return bootPromise;
}
