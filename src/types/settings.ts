import type { Difficulty, FeedbackFrequency, PresentationLayout, SessionMode } from '@/types/domain';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentColor = 'blue' | 'violet' | 'teal' | 'rose' | 'amber';
export type AIProviderKind = 'local' | 'gemini';

export interface AppSettings {
  theme: ThemeMode;
  accent: AccentColor;
  language: 'vi';
  displayName: string;
  defaultCameraId: string;
  defaultMicId: string;
  defaultStudentCount: number;
  defaultMode: SessionMode;
  difficulty: Difficulty;
  studentActivity: number;
  feedbackFrequency: FeedbackFrequency;
  recordingEnabled: boolean;
  aiProvider: AIProviderKind;
  aiEndpoint: string;
  aiModel: string;
  /** Preferred slide/camera arrangement when a lesson has a presentation. */
  presentationLayout: PresentationLayout;
  hasSeenOnboarding: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  accent: 'blue',
  language: 'vi',
  displayName: '',
  defaultCameraId: '',
  defaultMicId: '',
  defaultStudentCount: 10,
  defaultMode: 'natural',
  difficulty: 'medium',
  studentActivity: 55,
  feedbackFrequency: 'normal',
  recordingEnabled: false,
  aiProvider: 'local',
  aiEndpoint: '/api/ai',
  aiModel: 'gemini-2.5-flash',
  presentationLayout: 'slide_main',
  hasSeenOnboarding: false,
};
