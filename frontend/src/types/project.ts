import { NoteData } from './note';

export interface ProjectMetadata {
  title: string;
  instrument: string;
  tempo: number;
  timeSignature: string;
  key: string;
}

export interface Project {
  version: string;
  metadata: ProjectMetadata;
  notes: NoteData[];
}

export interface TranscriptionResult {
  success: boolean;
  data: TranscriptionData;
}

export interface TranscriptionData {
  notes: NoteData[];
  tempo: number;
  key: string;
  timeSignature: string;
  instrument: string;
}