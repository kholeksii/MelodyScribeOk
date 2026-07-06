import { useProjectStore } from '../store/projectStore';
import { NoteData, ProjectMetadata } from '../types';

// Working-session autosave (U19). The audio blob is NOT persisted — too big
// for localStorage; we keep audioFileId so the waveform can reload while the
// backend still has the upload.
export const AUTOSAVE_KEY = 'melodyscribe.autosave';
export const DEBOUNCE_MS = 2000;
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface AutosaveData {
  notes: NoteData[];
  metadata: ProjectMetadata | null;
  audioFileId: string | null;
  savedAt: number;
}

/** Valid, non-empty, younger than 7 days — otherwise null (stale entries are dropped). */
export function readAutosave(now: number = Date.now()): AutosaveData | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AutosaveData;
    if (!data || !Array.isArray(data.notes) || data.notes.length === 0) {
      localStorage.removeItem(AUTOSAVE_KEY);
      return null;
    }
    if (typeof data.savedAt !== 'number' || now - data.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(AUTOSAVE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** Called on explicit Save Project and on Start New Transcription. */
export function clearAutosave(): void {
  localStorage.removeItem(AUTOSAVE_KEY);
}

/**
 * Watch the project store and persist notes/metadata 2s after the last
 * change. Emptying the notes clears the autosave. Returns an unsubscribe.
 */
export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = useProjectStore.subscribe((state, prevState) => {
    if (state.notes === prevState.notes && state.metadata === prevState.metadata) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const { notes, metadata, audioFileId } = useProjectStore.getState();
      if (notes.length === 0) {
        clearAutosave();
        return;
      }
      const data: AutosaveData = { notes, metadata, audioFileId, savedAt: Date.now() };
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
      } catch {
        // Quota exceeded or storage unavailable — autosave is best-effort
      }
    }, DEBOUNCE_MS);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
