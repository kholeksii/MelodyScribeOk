import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'uk' | 'en';
export type Theme = 'light' | 'dark' | 'system';

interface UiState {
  language: Language;
  theme: Theme;
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme) => void;
}

// Primary user is a Ukrainian-speaking teacher — Ukrainian is the default.
// Theme defaults to the OS preference until the user toggles explicitly.
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      language: 'uk',
      theme: 'system',
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'melodyscribe-ui' }
  )
);
