import { describe, it, expect } from 'vitest';
import {
  parsePitch,
  createPitch,
  transposeSemitones,
  transposeOctaves,
  toggleDotted,
  durationToBeats,
  noteAtTime,
  formatTimecode,
} from './noteUtils';
import { NoteData } from '../types';

describe('parsePitch', () => {
  it('parses natural, sharp and flat pitches', () => {
    expect(parsePitch('G3')).toEqual({ note: 'G', octave: 3 });
    expect(parsePitch('F#5')).toEqual({ note: 'F#', octave: 5 });
    expect(parsePitch('Bb4')).toEqual({ note: 'Bb', octave: 4 });
  });

  it('returns null for rests and garbage', () => {
    expect(parsePitch('rest')).toBeNull();
    expect(parsePitch('')).toBeNull();
    expect(parsePitch('H2')).toBeNull();
  });
});

describe('createPitch', () => {
  it('clamps octave to 0–8', () => {
    expect(createPitch('A', 12)).toBe('A8');
    expect(createPitch('A', -3)).toBe('A0');
  });
});

describe('transposeSemitones', () => {
  it('crosses octave boundaries', () => {
    expect(transposeSemitones('B4', 1)).toBe('C5');
    expect(transposeSemitones('C5', -1)).toBe('B4');
  });

  it('moves within an octave', () => {
    expect(transposeSemitones('G4', 1)).toBe('G#4');
    expect(transposeSemitones('A4', -2)).toBe('G4');
  });

  it('normalizes flats, including the Cb edge case', () => {
    expect(transposeSemitones('Bb3', 2)).toBe('C4');
    // Cb4 is enharmonic B3, so +1 gives C4
    expect(transposeSemitones('Cb4', 1)).toBe('C4');
    expect(transposeSemitones('Fb4', 1)).toBe('F4');
  });

  it('leaves rests and out-of-range results unchanged', () => {
    expect(transposeSemitones('rest', 1)).toBe('rest');
    expect(transposeSemitones('B8', 1)).toBe('B8');
    expect(transposeSemitones('C0', -1)).toBe('C0');
  });
});

describe('transposeOctaves', () => {
  it('shifts whole octaves and refuses to leave the range', () => {
    expect(transposeOctaves('A4', 1)).toBe('A5');
    expect(transposeOctaves('A4', -1)).toBe('A3');
    expect(transposeOctaves('A8', 1)).toBe('A8');
  });
});

describe('toggleDotted', () => {
  it('adds and removes the dot', () => {
    expect(toggleDotted('quarter')).toBe('quarter.');
    expect(toggleDotted('quarter.')).toBe('quarter');
  });

  it('skips durations without a dotted variant', () => {
    expect(toggleDotted('whole')).toBe('whole');
    expect(toggleDotted('sixteenth')).toBe('sixteenth');
  });
});

describe('durationToBeats', () => {
  it('handles plain and dotted durations', () => {
    expect(durationToBeats('whole')).toBe(4);
    expect(durationToBeats('quarter.')).toBe(1.5);
    expect(durationToBeats('unknown')).toBe(1);
  });
});

describe('noteAtTime', () => {
  const note = (id: string, startBeat: number, duration: string): NoteData => ({
    id,
    pitch: 'G4',
    duration,
    startBeat,
    measure: 1,
    velocity: 80,
    confidence: 1,
    theoryCorrected: false,
  });
  // 120 BPM → 0.5 s per beat: a=0–0.5s, b=0.5–1.5s
  const notes = [note('a', 0, 'quarter'), note('b', 1, 'half')];

  it('finds the note containing the time', () => {
    expect(noteAtTime(notes, 120, 0.25)?.id).toBe('a');
    expect(noteAtTime(notes, 120, 0.75)?.id).toBe('b');
  });

  it('treats range ends as half-open', () => {
    expect(noteAtTime(notes, 120, 0.5)?.id).toBe('b');
    expect(noteAtTime(notes, 120, 1.5)).toBeNull();
  });

  it('returns null outside any note and for a broken tempo', () => {
    expect(noteAtTime(notes, 120, 99)).toBeNull();
    expect(noteAtTime(notes, 0, 0.25)).toBeNull();
  });
});

describe('formatTimecode', () => {
  it('formats mm:ss.mmm', () => {
    expect(formatTimecode(0)).toBe('00:00.000');
    expect(formatTimecode(65.432)).toBe('01:05.432');
    expect(formatTimecode(-1)).toBe('00:00.000');
  });
});
