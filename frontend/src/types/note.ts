export interface NoteData {
  id: string;
  pitch: string;
  duration: string;
  startBeat: number;
  measure: number;
  velocity: number;
  confidence: number;
  llmCorrected: boolean;
}

export interface Correction {
  noteIndex: number;
  field: 'pitch' | 'duration';
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface LLMVerificationResult {
  corrections: Correction[];
  confidence: number;
  error?: string;
}