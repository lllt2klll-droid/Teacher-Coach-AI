export const PRESENTATION_CHANNEL_PREFIX = 'teacher-coach-presentation';

export function presentationChannelName(lessonPlanId: string): string {
  return `${PRESENTATION_CHANNEL_PREFIX}:${lessonPlanId}`;
}

export type PresentationChannelMessage =
  | { type: 'slide'; index: number; total: number }
  | { type: 'navigate'; index: number }
  | { type: 'request-state' };
