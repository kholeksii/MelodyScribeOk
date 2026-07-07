import { describe, it, expect } from 'vitest';
import {
  parsePitch,
  createPitch,
  transposeSemitones,
  transposeOctaves,
  toggleDotted,
  durationToBeats,
} from './noteUtils';

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
