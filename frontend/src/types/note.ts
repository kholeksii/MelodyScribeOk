export interface NoteData {
  id: string;
  pitch: string;
  duration: string;
  startBeat: number;
  measure: number;
  velocity: number;
  confidence: number;
  theoryCorrected: boolean;
  articulation?: string | null;
  tuplet?: 'triplet' | null;
  tieStart?: boolean;
  tieEnd?: boolean;
}

export interface Correction {
  noteIndex: number;
  field: 'pitch' | 'duration';
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface TheoryVerificationResult {
  corrections: Correction[];
  confidence: number;
  error?: string;
}