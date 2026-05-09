import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RecentProject {
  name: string;
  savedAt: number;
}

interface RecentProjectsState {
  recents: RecentProject[];
  addRecent: (name: string) => void;
  clearRecents: () => void;
}

export const useRecentProjectsStore = create<RecentProjectsState>()(
  persist(
    (set) => ({
      recents: [],
      addRecent: (name) =>
        set((state) => {
          const filtered = state.recents.filter((r) => r.name !== name);
          return { recents: [{ name, savedAt: Date.now() }, ...filtered].slice(0, 5) };
        }),
      clearRecents: () => set({ recents: [] }),
    }),
    { name: 'melodyscribe_recent_projects' },
  ),
);
