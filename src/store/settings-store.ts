import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types/settings';

interface SettingsStore extends AppSettings {
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(patch),
      // Resetting appearance/defaults should not force the teacher through
      // onboarding again; the intro stays reachable from Settings.
      reset: () => set((state) => ({ ...DEFAULT_SETTINGS, hasSeenOnboarding: state.hasSeenOnboarding })),
    }),
    {
      name: 'teacher-coach-settings',
      version: 1,
      partialize: (state) => {
        const { update: _update, reset: _reset, ...rest } = state;
        return rest;
      },
    },
  ),
);
