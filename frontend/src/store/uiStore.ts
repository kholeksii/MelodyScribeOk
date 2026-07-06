import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'uk' | 'en';

interface UiState {
  language: Language;
  setLanguage: (language: Language) => void;
}

// Primary user is a Ukrainian-speaking teacher — Ukrainian is the default
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      language: 'uk',
      setLanguage: (language) => set({ language }),
    }),
    { name: 'melodyscribe-ui' }
  )
);
