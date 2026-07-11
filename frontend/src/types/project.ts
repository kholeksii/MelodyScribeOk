import { NoteData } from './note';

export interface ProjectMetadata {
  title: string;
  instrument: string;
  tempo: number;
  timeSignature: string;
  key: string;
  /** true when the meter came from U31 auto-detection (chip shows «(авто)») */
  timeSignatureAuto?: boolean;
}

export interface Project {
  version: string;
  metadata: ProjectMetadata;
  notes: NoteData[];
}

export interface TranscriptionData {
  notes: NoteData[];
  tempo: number;
  key: string;
  timeSignature: string;
  instrument: string;
  /** non-null when the backend auto-detected the meter (U31) */
  timeSignatureConfidence?: number | null;
}