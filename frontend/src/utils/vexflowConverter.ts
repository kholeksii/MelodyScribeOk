import { NoteData } from '../types';

/** Convert key signature from backend format to VexFlow format: "B major" -> "B", "A minor" -> "Am". */
export function convertKeySignatureToVexFlow(key: string): string {
  if (!key) return '';

  const parts = key.split(' ');
  const note = parts[0]; // "B", "A#", "Db", etc.
  const mode = parts[1]?.toLowerCase(); // "major", "minor"

  if (mode === 'minor') {
    return note + 'm';
  }
  return note;
}

/** Convert scientific pitch to VexFlow key format: "C#4" -> "c#/4". */
export function convertPitchToVexFlow(pitch: string): string {
  // Normalize Unicode accidentals (librosa uses ♯/♭, VexFlow needs #/b)
  const normalized = pitch.replace('♯', '#').replace('♭', 'b');
  const note = normalized.slice(0, -1).toLowerCase();
  const octave = normalized.slice(-1);
  return `${note}/${octave}`;
}

const DURATION_MAP: { [key: string]: string } = {
  whole: 'w',
  half: 'h',
  quarter: 'q',
  eighth: '8',
  sixteenth: '16',
};

/** Convert backend duration name to a VexFlow duration code.
 * TODO(U13): dotted durations ("half.", "quarter.", "eighth.") currently
 * fall back to a plain quarter — they need a dot modifier in VexFlow. */
export function convertDurationToVexFlow(duration: string): string {
  return DURATION_MAP[duration] || 'q'; // Default to quarter note
}

/** Group notes by measure number, groups ordered by measure. */
export function groupNotesByMeasure(notes: NoteData[]): NoteData[][] {
  const measureGroups = new Map<number, NoteData[]>();
  notes.forEach((note) => {
    const m = note.measure || 1;
    if (!measureGroups.has(m)) measureGroups.set(m, []);
    measureGroups.get(m)!.push(note);
  });
  return Array.from(measureGroups.keys())
    .sort((a, b) => a - b)
    .map((m) => measureGroups.get(m)!);
}

/** Confidence → base color: green ≥0.9, amber 0.7–0.9, red <0.7. */
export function confidenceColor(confidence: number): string {
  if (confidence >= 0.9) return '#16a34a'; // green-600
  if (confidence >= 0.7) return '#d97706'; // amber-600
  return '#dc2626'; // red-600
}
