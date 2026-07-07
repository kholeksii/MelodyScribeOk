// Shared pitch/duration math for the note editor (NoteToolbar, keyboard editing).

const PITCH_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Enharmonic flats → sharps; Cb lives in the octave below (Cb4 = B3)
const FLAT_TO_SHARP: Record<string, { note: string; octaveShift: number }> = {
  Db: { note: 'C#', octaveShift: 0 },
  Eb: { note: 'D#', octaveShift: 0 },
  Fb: { note: 'E', octaveShift: 0 },
  Gb: { note: 'F#', octaveShift: 0 },
  Ab: { note: 'G#', octaveShift: 0 },
  Bb: { note: 'A#', octaveShift: 0 },
  Cb: { note: 'B', octaveShift: -1 },
};

const MIN_OCTAVE = 0;
const MAX_OCTAVE = 8;

export interface ParsedPitch {
  note: string;
  octave: number;
}

/** "F#5" → { note: "F#", octave: 5 }; returns null for rests and unparseable strings. */
export function parsePitch(pitch: string): ParsedPitch | null {
  const match = pitch.match(/^([A-Ga-g][#b]?)(\d)$/);
  if (!match) return null;
  const note = match[1][0].toUpperCase() + match[1].slice(1);
  return { note, octave: Number(match[2]) };
}

/** { note: "G", octave: 3 } → "G3", octave clamped to 0–8. */
export function createPitch(note: string, octave: number): string {
  const clamped = Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, octave));
  return `${note}${clamped}`;
}

/** Semitone index 0–11 + octave, with flats normalized to sharps; null if unknown. */
function toChromatic(pitch: string): { index: number; octave: number } | null {
  const parsed = parsePitch(pitch);
  if (!parsed) return null;
  let { note, octave } = parsed;
  const flat = FLAT_TO_SHARP[note];
  if (flat) {
    note = flat.note;
    octave += flat.octaveShift;
  }
  const index = PITCH_NOTES.indexOf(note);
  if (index === -1) return null;
  return { index, octave };
}

/**
 * Transpose by semitones ("B4" +1 → "C5"). Rests, unparseable pitches and
 * results outside octaves 0–8 come back unchanged.
 */
export function transposeSemitones(pitch: string, delta: number): string {
  const chromatic = toChromatic(pitch);
  if (!chromatic) return pitch;
  const total = chromatic.octave * 12 + chromatic.index + delta;
  const octave = Math.floor(total / 12);
  if (octave < MIN_OCTAVE || octave > MAX_OCTAVE) return pitch;
  return createPitch(PITCH_NOTES[((total % 12) + 12) % 12], octave);
}

/** Transpose by whole octaves; out-of-range results come back unchanged. */
export function transposeOctaves(pitch: string, delta: number): string {
  return transposeSemitones(pitch, delta * 12);
}

/** Durations selectable in the editor, in shortcut order (keys 1–5). */
export const DURATIONS = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'] as const;

// Dotted whole/sixteenth are not supported by playback/rendering maps
const DOTTABLE = new Set(['half', 'quarter', 'eighth']);

/** "quarter" ↔ "quarter."; durations without a dotted variant come back unchanged. */
export function toggleDotted(duration: string): string {
  if (duration.endsWith('.')) return duration.slice(0, -1);
  return DOTTABLE.has(duration) ? `${duration}.` : duration;
}

const DURATION_BEATS: Record<string, number> = {
  whole: 4,
  'half.': 3,
  half: 2,
  'quarter.': 1.5,
  quarter: 1,
  'eighth.': 0.75,
  eighth: 0.5,
  sixteenth: 0.25,
};

/** Duration name → beats in 4/4; unknown values count as one beat. */
export function durationToBeats(duration: string): number {
  return DURATION_BEATS[duration] ?? 1;
}
