import { useEffect, useSyncExternalStore } from 'react';
import { useUiStore, Theme } from '../store/uiStore';

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function subscribeToSystem(onChange: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

export function resolveIsDark(theme: Theme): boolean {
  return theme === 'dark' || (theme === 'system' && prefersDark());
}

/** Keeps the .dark class on <html> in sync; call once at the App root. */
export function useApplyTheme(): void {
  const theme = useUiStore((s) => s.theme);
  const systemDark = useSyncExternalStore(subscribeToSystem, prefersDark);

  useEffect(() => {
    const isDark = theme === 'dark' || (theme === 'system' && systemDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, [theme, systemDark]);
}

/** Current effective darkness + a toggle that makes the choice explicit. */
export function useThemeToggle(): { isDark: boolean; toggle: () => void } {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const systemDark = useSyncExternalStore(subscribeToSystem, prefersDark);
  const isDark = theme === 'dark' || (theme === 'system' && systemDark);
  return { isDark, toggle: () => setTheme(isDark ? 'light' : 'dark') };
}
