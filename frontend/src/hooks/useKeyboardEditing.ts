import { useEffect, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { NoteData } from '../types';
import {
  transposeSemitones,
  transposeOctaves,
  toggleDotted,
  durationToBeats,
  DURATIONS,
} from '../utils/noteUtils';

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  );
}

/** Nearest non-rest neighbor's pitch, for turning a rest back into a note. */
function neighborPitch(notes: NoteData[], index: number): string {
  for (let offset = 1; offset < notes.length; offset++) {
    const before = notes[index - offset];
    if (before && before.pitch !== 'rest') return before.pitch;
    const after = notes[index + offset];
    if (after && after.pitch !== 'rest') return after.pitch;
  }
  return 'B4';
}

/**
 * Keyboard-first note editing (U18). Letter/digit shortcuts match physical
 * keys (e.code), so they work on the Ukrainian layout too. All mutations go
 * through store actions, so undo/redo covers every step.
 */
export function useKeyboardEditing() {
  const [helpVisible, setHelpVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // leave Ctrl+Z etc. alone

      if (e.key === '?' || (e.code === 'Slash' && e.shiftKey)) {
        e.preventDefault();
        setHelpVisible((v) => !v);
        return;
      }

      const store = useProjectStore.getState();
      const { notes, selectedNoteId } = store;

      if (e.key === 'Escape') {
        if (helpVisible) {
          setHelpVisible(false);
        } else if (selectedNoteId) {
          store.setSelectedNote(null);
        }
        return;
      }

      if (notes.length === 0) return;
      const index = notes.findIndex((n) => n.id === selectedNoteId);

      // Arrows navigate even without a selection (start from the first note)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (index === -1) {
          store.setSelectedNote(notes[0].id);
          return;
        }
        const next = e.key === 'ArrowLeft' ? index - 1 : index + 1;
        if (next >= 0 && next < notes.length) store.setSelectedNote(notes[next].id); // no wrap
        return;
      }

      // Everything below needs a selected note
      if (index === -1) return;
      const selected = notes[index];

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (selected.pitch === 'rest') return;
        const delta = e.key === 'ArrowUp' ? 1 : -1;
        const pitch = e.shiftKey
          ? transposeOctaves(selected.pitch, delta)
          : transposeSemitones(selected.pitch, delta);
        if (pitch !== selected.pitch) store.updateNote(selected.id, { pitch });
        return;
      }

      const digitMatch = e.code.match(/^Digit([1-5])$/);
      if (digitMatch) {
        e.preventDefault();
        store.updateNote(selected.id, { duration: DURATIONS[Number(digitMatch[1]) - 1] });
        return;
      }

      if (e.code === 'Period') {
        e.preventDefault();
        const duration = toggleDotted(selected.duration);
        if (duration !== selected.duration) store.updateNote(selected.id, { duration });
        return;
      }

      if (e.code === 'KeyR') {
        e.preventDefault();
        if (selected.pitch === 'rest') {
          store.updateNote(selected.id, { pitch: neighborPitch(notes, index), velocity: 80 });
        } else {
          store.updateNote(selected.id, { pitch: 'rest', velocity: 0 });
        }
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        store.deleteNote(selected.id);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const inserted: NoteData = {
          ...selected,
          id: `note-${Date.now()}`,
          duration: 'quarter',
          startBeat: selected.startBeat + durationToBeats(selected.duration),
          confidence: 1,
          theoryCorrected: false,
        };
        store.insertNote(selected.id, inserted);
        store.setSelectedNote(inserted.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [helpVisible]);

  return { helpVisible, setHelpVisible };
}
