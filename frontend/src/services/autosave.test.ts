import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  startAutosave,
  readAutosave,
  clearAutosave,
  AUTOSAVE_KEY,
  DEBOUNCE_MS,
  MAX_AGE_MS,
} from './autosave';
import { useProjectStore } from '../store/projectStore';
import { NoteData } from '../types';

const note = (id: string): NoteData => ({
  id,
  pitch: 'G4',
  duration: 'quarter',
  startBeat: 0,
  measure: 1,
  velocity: 80,
  confidence: 1,
  theoryCorrected: false,
});

describe('autosave', () => {
  let stop: (() => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    useProjectStore.getState().reset();
  });

  afterEach(() => {
    stop?.();
    stop = null;
    vi.useRealTimers();
  });

  it('debounces writes: saves once, 2s after the last change', () => {
    stop = startAutosave();
    useProjectStore.getState().setNotes([note('a')]);

    vi.advanceTimersByTime(DEBOUNCE_MS - 1);
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull();

    // A second change inside the window restarts the timer
    useProjectStore.getState().updateNote('a', { pitch: 'A4' });
    vi.advanceTimersByTime(DEBOUNCE_MS - 1);
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull();

    vi.advanceTimersByTime(1);
    const saved = readAutosave();
    expect(saved).not.toBeNull();
    expect(saved!.notes[0].pitch).toBe('A4');
  });

  it('ignores unrelated store changes (selection does not trigger a save)', () => {
    stop = startAutosave();
    useProjectStore.getState().setSelectedNote('a');
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull();
  });

  it('clears the autosave when the notes are emptied', () => {
    stop = startAutosave();
    useProjectStore.getState().setNotes([note('a')]);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(localStorage.getItem(AUTOSAVE_KEY)).not.toBeNull();

    useProjectStore.getState().setNotes([]);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull();
  });

  it('readAutosave drops entries older than 7 days', () => {
    const savedAt = Date.now();
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({ notes: [note('a')], metadata: null, audioFileId: null, savedAt })
    );

    expect(readAutosave(savedAt + MAX_AGE_MS)).not.toBeNull();
    expect(readAutosave(savedAt + MAX_AGE_MS + 1)).toBeNull();
    // Stale entry is removed from storage
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull();
  });

  it('readAutosave rejects empty and malformed payloads', () => {
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({ notes: [], metadata: null, audioFileId: null, savedAt: Date.now() })
    );
    expect(readAutosave()).toBeNull();

    localStorage.setItem(AUTOSAVE_KEY, 'not json');
    expect(readAutosave()).toBeNull();
  });

  it('clearAutosave removes the entry', () => {
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({ notes: [note('a')], metadata: null, audioFileId: null, savedAt: Date.now() })
    );
    clearAutosave();
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull();
  });

  it('stops saving after unsubscribe', () => {
    stop = startAutosave();
    stop();
    stop = null;
    useProjectStore.getState().setNotes([note('a')]);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull();
  });
});
