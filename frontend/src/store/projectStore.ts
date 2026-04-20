import { create } from 'zustand';
import { NoteData, ProjectMetadata, Correction } from '../types';

interface ProjectState {
  notes: NoteData[];
  metadata: ProjectMetadata | null;
  audioFileId: string | null;
  selectedNoteId: string | null;
  isLoading: boolean;
  error: string | null;
  corrections: Correction[];
  verificationConfidence: number;

  setNotes: (notes: NoteData[]) => void;
  updateNote: (id: string, updates: Partial<NoteData>) => void;
  deleteNote: (id: string) => void;
  insertNote: (afterId: string, note: NoteData) => void;
  setMetadata: (meta: ProjectMetadata | null) => void;
  setSelectedNote: (id: string | null) => void;
  setAudioFileId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCorrections: (corrections: Correction[]) => void;
  setVerificationConfidence: (confidence: number) => void;
  clearCorrections: () => void;
  reset: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  notes: [],
  metadata: null,
  audioFileId: null,
  selectedNoteId: null,
  isLoading: false,
  error: null,
  corrections: [],
  verificationConfidence: 0,

  setNotes: (notes) => set({ notes }),

  updateNote: (id, updates) => set((state) => ({
    notes: state.notes.map(note =>
      note.id === id ? { ...note, ...updates } : note
    ),
  })),

  deleteNote: (id) => set((state) => ({
    notes: state.notes.filter(note => note.id !== id),
    selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
  })),

  insertNote: (afterId, note) => set((state) => {
    const index = state.notes.findIndex(n => n.id === afterId);
    if (index === -1) return state;

    const newNotes = [...state.notes];
    newNotes.splice(index + 1, 0, note);
    return { notes: newNotes };
  }),

  setMetadata: (metadata) => set({ metadata }),

  setSelectedNote: (selectedNoteId) => set({ selectedNoteId }),

  setAudioFileId: (audioFileId) => set({ audioFileId }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setCorrections: (corrections) => set({ corrections }),

  setVerificationConfidence: (confidence) => set({ verificationConfidence: confidence }),

  clearCorrections: () => set({ corrections: [], verificationConfidence: 0 }),

  reset: () => set({
    notes: [],
    metadata: null,
    audioFileId: null,
    selectedNoteId: null,
    isLoading: false,
    error: null,
    corrections: [],
    verificationConfidence: 0,
  }),
}));