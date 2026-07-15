import { create } from 'zustand';
import { NoteData, ProjectMetadata, Correction } from '../types';

const MAX_HISTORY = 50;

interface ProjectState {
  notes: NoteData[];
  past: NoteData[][];
  future: NoteData[][];
  metadata: ProjectMetadata | null;
  audioFileId: string | null;
  audioFileName: string | null;
  audioFileDurationSec: number | null;
  audioBlob: Blob | null;
  selectedNoteId: string | null;
  playingNoteId: string | null;
  /** Whether the Tone.js transport is currently running (mirrored by usePlayback). */
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  corrections: Correction[];
  verificationConfidence: number;

  setNotes: (notes: NoteData[]) => void;
  updateNote: (id: string, updates: Partial<NoteData>) => void;
  deleteNote: (id: string) => void;
  insertNote: (afterId: string, note: NoteData) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  setMetadata: (meta: ProjectMetadata | null) => void;
  setSelectedNote: (id: string | null) => void;
  setPlayingNoteId: (id: string | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setAudioFileId: (id: string | null) => void;
  setAudioFileInfo: (name: string | null, durationSec: number | null) => void;
  clearAudioFile: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  shiftAllOctaves: (direction: 1 | -1) => void;
  setAudioBlob: (blob: Blob | null) => void;
  loadFromProject: (project: import('../types').Project, audioBlob: Blob | null) => void;
  setCorrections: (corrections: Correction[]) => void;
  setVerificationConfidence: (confidence: number) => void;
  clearCorrections: () => void;
  reset: () => void;
}

function pushHistory(past: NoteData[][], current: NoteData[]): NoteData[][] {
  const next = [...past, current];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  notes: [],
  past: [],
  future: [],
  metadata: null,
  audioFileId: null,
  audioFileName: null,
  audioFileDurationSec: null,
  audioBlob: null,
  selectedNoteId: null,
  playingNoteId: null,
  isPlaying: false,
  isLoading: false,
  error: null,
  corrections: [],
  verificationConfidence: 0,

  // setNotes does NOT push to history (used for initial load / transcription result)
  setNotes: (notes) => set({ notes, past: [], future: [] }),

  updateNote: (id, updates) => set((state) => ({
    past: pushHistory(state.past, state.notes),
    future: [],
    notes: state.notes.map(note => note.id === id ? { ...note, ...updates } : note),
  })),

  deleteNote: (id) => set((state) => ({
    past: pushHistory(state.past, state.notes),
    future: [],
    notes: state.notes.filter(note => note.id !== id),
    selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
  })),

  insertNote: (afterId, note) => set((state) => {
    const index = state.notes.findIndex(n => n.id === afterId);
    if (index === -1) return state;
    const newNotes = [...state.notes];
    newNotes.splice(index + 1, 0, note);
    return {
      past: pushHistory(state.past, state.notes),
      future: [],
      notes: newNotes,
    };
  }),

  undo: () => set((state) => {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    return {
      notes: previous,
      past: state.past.slice(0, -1),
      future: [state.notes, ...state.future],
      selectedNoteId: null,
    };
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    return {
      notes: next,
      past: pushHistory(state.past, state.notes),
      future: state.future.slice(1),
      selectedNoteId: null,
    };
  }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  shiftAllOctaves: (direction) => set((state) => {
    const shifted = state.notes.map((note) => {
      if (note.pitch === 'rest') return note;
      const match = note.pitch.match(/^([A-Ga-g][#b]?)(\d+)$/);
      if (!match) return note;
      const newOctave = Math.max(1, Math.min(8, Number(match[2]) + direction));
      return { ...note, pitch: `${match[1]}${newOctave}` };
    });
    return {
      past: pushHistory(state.past, state.notes),
      future: [],
      notes: shifted,
    };
  }),

  setAudioBlob: (audioBlob) => set({ audioBlob }),

  loadFromProject: (project, audioBlob) => set({
    notes: project.notes,
    metadata: project.metadata,
    audioBlob,
    audioFileId: null,
    audioFileName: null,
    audioFileDurationSec: null,
    past: [],
    future: [],
    selectedNoteId: null,
    corrections: [],
    verificationConfidence: 0,
  }),

  setMetadata: (metadata) => set({ metadata }),
  setSelectedNote: (selectedNoteId) => set({ selectedNoteId }),
  setPlayingNoteId: (playingNoteId) => set({ playingNoteId }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setAudioFileId: (audioFileId) => set({ audioFileId }),
  setAudioFileInfo: (audioFileName, audioFileDurationSec) => set({ audioFileName, audioFileDurationSec }),
  clearAudioFile: () => set({
    audioFileId: null,
    audioFileName: null,
    audioFileDurationSec: null,
    audioBlob: null,
  }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setCorrections: (corrections) => set({ corrections }),
  setVerificationConfidence: (confidence) => set({ verificationConfidence: confidence }),
  clearCorrections: () => set({ corrections: [], verificationConfidence: 0 }),

  reset: () => set({
    notes: [],
    past: [],
    future: [],
    metadata: null,
    audioFileId: null,
    audioFileName: null,
    audioFileDurationSec: null,
    audioBlob: null,
    selectedNoteId: null,
    playingNoteId: null,
    isPlaying: false,
    isLoading: false,
    error: null,
    corrections: [],
    verificationConfidence: 0,
  }),
}));
