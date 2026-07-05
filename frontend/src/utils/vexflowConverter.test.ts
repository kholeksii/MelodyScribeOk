import { describe, expect, it } from 'vitest';
import {
  confidenceColor,
  convertDurationToVexFlow,
  convertKeySignatureToVexFlow,
  convertPitchToVexFlow,
  groupNotesByMeasure,
} from './vexflowConverter';
import { NoteData } from '../types';

function note(id: string, measure: number): NoteData {
  return {
    id,
    pitch: 'C4',
    duration: 'quarter',
    startBeat: 0,
    measure,
    velocity: 80,
    confidence: 1,
    theoryCorrected: false,
  };
}

describe('convertKeySignatureToVexFlow', () => {
  it('maps majors to the bare tonic', () => {
    expect(convertKeySignatureToVexFlow('B major')).toBe('B');
    expect(convertKeySignatureToVexFlow('Db major')).toBe('Db');
  });

  it('maps minors to tonic + m', () => {
    expect(convertKeySignatureToVexFlow('A minor')).toBe('Am');
  });

  it('returns empty string for empty input', () => {
    expect(convertKeySignatureToVexFlow('')).toBe('');
  });

  it('passes through a bare tonic without mode', () => {
    expect(convertKeySignatureToVexFlow('G')).toBe('G');
  });
});

describe('convertPitchToVexFlow', () => {
  it('converts scientific pitch to vexflow key', () => {
    expect(convertPitchToVexFlow('C4')).toBe('c/4');
    expect(convertPitchToVexFlow('F#5')).toBe('f#/5');
    expect(convertPitchToVexFlow('Bb3')).toBe('bb/3');
  });

  it('normalizes unicode accidentals from librosa', () => {
    expect(convertPitchToVexFlow('C♯4')).toBe('c#/4');
    expect(convertPitchToVexFlow('B♭3')).toBe('bb/3');
  });
});

describe('convertDurationToVexFlow', () => {
  it('maps plain durations', () => {
    expect(convertDurationToVexFlow('whole')).toBe('w');
    expect(convertDurationToVexFlow('half')).toBe('h');
    expect(convertDurationToVexFlow('quarter')).toBe('q');
    expect(convertDurationToVexFlow('eighth')).toBe('8');
    expect(convertDurationToVexFlow('sixteenth')).toBe('16');
  });

  it('falls back to quarter for unknown values (incl. dotted — see U13)', () => {
    expect(convertDurationToVexFlow('quarter.')).toBe('q');
    expect(convertDurationToVexFlow('half.')).toBe('q');
    expect(convertDurationToVexFlow('nonsense')).toBe('q');
  });
});

describe('groupNotesByMeasure', () => {
  it('groups notes and orders groups by measure number', () => {
    const groups = groupNotesByMeasure([note('a', 2), note('b', 1), note('c', 2)]);
    expect(groups.map((g) => g.map((n) => n.id))).toEqual([['b'], ['a', 'c']]);
  });

  it('treats measure 0/undefined as measure 1', () => {
    const groups = groupNotesByMeasure([note('a', 0), note('b', 1)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('returns empty array for no notes', () => {
    expect(groupNotesByMeasure([])).toEqual([]);
  });
});

describe('confidenceColor', () => {
  it('applies the documented thresholds', () => {
    expect(confidenceColor(0.95)).toBe('#16a34a');
    expect(confidenceColor(0.9)).toBe('#16a34a');
    expect(confidenceColor(0.8)).toBe('#d97706');
    expect(confidenceColor(0.7)).toBe('#d97706');
    expect(confidenceColor(0.5)).toBe('#dc2626');
  });
});
