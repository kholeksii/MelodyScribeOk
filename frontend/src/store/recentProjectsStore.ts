import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RecentProject {
  name: string;
  /** Absolute file path — only known in Electron; entries saved from the
   * browser (or persisted before U20) have no path and are not clickable. */
  path?: string | null;
  savedAt: number;
}

interface RecentProjectsState {
  recents: RecentProject[];
  addRecent: (name: string, path?: string | null) => void;
  removeRecent: (entry: RecentProject) => void;
  clearRecents: () => void;
}

export const useRecentProjectsStore = create<RecentProjectsState>()(
  persist(
    (set) => ({
      recents: [],
      addRecent: (name, path = null) =>
        set((state) => {
          // Dedupe by path when known, and always by name (legacy entries)
          const filtered = state.recents.filter(
            (r) => r.name !== name && !(path != null && r.path === path)
          );
          return { recents: [{ name, path, savedAt: Date.now() }, ...filtered].slice(0, 5) };
        }),
      removeRecent: (entry) =>
        set((state) => ({
          recents: state.recents.filter(
            (r) => !(r.name === entry.name && (r.path ?? null) === (entry.path ?? null))
          ),
        })),
      clearRecents: () => set({ recents: [] }),
    }),
    { name: 'melodyscribe_recent_projects' },
  ),
);
