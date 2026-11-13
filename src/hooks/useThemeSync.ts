import { useEffect } from 'react';
import { useSettingsStore } from '@/store/settings-store';

export function useThemeSync() {
  const theme = useSettingsStore((state) => state.theme);
  const accent = useSettingsStore((state) => state.accent);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = accent;
    const apply = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark));
    };
    apply();
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme, accent]);
}
