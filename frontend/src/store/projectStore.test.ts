import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from './projectStore';
import { NoteData, Project } from '../types';

function makeNote(id: string, pitch: string): NoteData {
  return {
    id,
    pitch,
    duration: 'quarter',
    startBeat: 0,
    measure: 1,
    velocity: 80,
    confidence: 0.9,
    theoryCorrected: false,
  };
}

describe('projectStore', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  describe('undo/redo', () => {
    it('updateNote pushes history and undo restores the previous state', () => {
      const store = useProjectStore.getState();
      store.setNotes([makeNote('n1', 'C4')]);

      useProjectStore.getState().updateNote('n1', { pitch: 'D4' });
      expect(useProjectStore.getState().notes[0].pitch).toBe('D4');

      useProjectStore.getState().undo();
      expect(useProjectStore.getState().notes[0].pitch).toBe('C4');
    });

    it('redo reapplies an undone change', () => {
      useProjectStore.getState().setNotes([makeNote('n1', 'C4')]);
      useProjectStore.getState().updateNote('n1', { pitch: 'D4' });
      useProjectStore.getState().undo();
      useProjectStore.getState().redo();
      expect(useProjectStore.getState().notes[0].pitch).toBe('D4');
    });

    it('a new edit clears the redo stack', () => {
      useProjectStore.getState().setNotes([makeNote('n1', 'C4')]);
      useProjectStore.getState().updateNote('n1', { pitch: 'D4' });
      useProjectStore.getState().undo();
      useProjectStore.getState().updateNote('n1', { pitch: 'E4' });
      expect(useProjectStore.getState().canRedo()).toBe(false);
    });

    it('setNotes resets history (initial load is not undoable)', () => {
      useProjectStore.getState().setNotes([makeNote('n1', 'C4')]);
      useProjectStore.getState().updateNote('n1', { pitch: 'D4' });
      useProjectStore.getState().setNotes([makeNote('n2', 'G4')]);
      expect(useProjectStore.getState().canUndo()).toBe(false);
    });

    it('history is capped at 50 entries', () => {
      useProjectStore.getState().setNotes([makeNote('n1', 'C4')]);
      for (let i = 0; i < 60; i++) {
        useProjectStore.getState().updateNote('n1', { velocity: i });
      }
      expect(useProjectStore.getState().past.length).toBe(50);
    });
  });

  describe('shiftAllOctaves', () => {
    it('shifts pitches up and leaves rests untouched', () => {
      useProjectStore.getState().setNotes([makeNote('n1', 'C4'), makeNote('n2', 'rest')]);
      useProjectStore.getState().shiftAllOctaves(1);
      const notes = useProjectStore.getState().notes;
      expect(notes[0].pitch).toBe('C5');
      expect(notes[1].pitch).toBe('rest');
    });

    it('handles accidentals and clamps octave to [1, 8]', () => {
      useProjectStore.getState().setNotes([makeNote('n1', 'F#8'), makeNote('n2', 'Bb1')]);
      useProjectStore.getState().shiftAllOctaves(1);
      expect(useProjectStore.getState().notes[0].pitch).toBe('F#8');
      useProjectStore.getState().shiftAllOctaves(-1);
      expect(useProjectStore.getState().notes[1].pitch).toBe('Bb1');
    });

    it('is undoable', () => {
      useProjectStore.getState().setNotes([makeNote('n1', 'C4')]);
      useProjectStore.getState().shiftAllOctaves(1);
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().notes[0].pitch).toBe('C4');
    });
  });

  describe('deleteNote', () => {
    it('removes the note and clears selection when it was selected', () => {
      useProjectStore.getState().setNotes([makeNote('n1', 'C4'), makeNote('n2', 'D4')]);
      useProjectStore.getState().setSelectedNote('n1');
      useProjectStore.getState().deleteNote('n1');
      expect(useProjectStore.getState().notes.map((n) => n.id)).toEqual(['n2']);
      expect(useProjectStore.getState().selectedNoteId).toBeNull();
    });

    it('keeps selection when a different note is deleted', () => {
      useProjectStore.getState().setNotes([makeNote('n1', 'C4'), makeNote('n2', 'D4')]);
      useProjectStore.getState().setSelectedNote('n2');
      useProjectStore.getState().deleteNote('n1');
      expect(useProjectStore.getState().selectedNoteId).toBe('n2');
    });
  });

  describe('insertNote', () => {
    it('inserts after the given note', () => {
      useProjectStore.getState().setNotes([makeNote('n1', 'C4'), makeNote('n2', 'E4')]);
      useProjectStore.getState().insertNote('n1', makeNote('n3', 'D4'));
      expect(useProjectStore.getState().notes.map((n) => n.id)).toEqual(['n1', 'n3', 'n2']);
    });

    it('is a no-op for an unknown anchor id', () => {
      useProjectStore.getState().setNotes([makeNote('n1', 'C4')]);
      useProjectStore.getState().insertNote('missing', makeNote('n3', 'D4'));
      expect(useProjectStore.getState().notes.map((n) => n.id)).toEqual(['n1']);
    });
  });

  describe('loadFromProject', () => {
    it('replaces state and resets history, selection and corrections', () => {
      useProjectStore.getState().setNotes([makeNote('n1', 'C4')]);
      useProjectStore.getState().updateNote('n1', { pitch: 'D4' });
      useProjectStore.getState().setSelectedNote('n1');
      useProjectStore
        .getState()
        .setCorrections([
          { noteIndex: 0, field: 'pitch', oldValue: 'C4', newValue: 'D4', reason: 'test' },
        ]);

      const project: Project = {
        version: '1.0',
        metadata: {
          title: 'Loaded',
          instrument: 'piano',
          tempo: 100,
          timeSignature: '3/4',
          key: 'G',
        },
        notes: [makeNote('n9', 'G4')],
      };
      useProjectStore.getState().loadFromProject(project, null);

      const state = useProjectStore.getState();
      expect(state.notes.map((n) => n.id)).toEqual(['n9']);
      expect(state.metadata?.title).toBe('Loaded');
      expect(state.canUndo()).toBe(false);
      expect(state.selectedNoteId).toBeNull();
      expect(state.corrections).toEqual([]);
    });
  });
});
