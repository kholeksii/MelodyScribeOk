import { AudioInfo, Correction, Instrument, TranscriptionData, NoteData, Project } from '../types';

const BASE_URL = 'http://localhost:8000/api';

/** Note shape as serialized by the Python backend (snake_case). */
interface BackendNote {
  id: string;
  pitch: string;
  duration: string;
  start_beat: number;
  measure: number;
  velocity?: number;
  confidence?: number;
  theory_corrected?: boolean;
  llm_corrected?: boolean; // pre-rename files
  articulation?: string | null;
}

interface Envelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

export interface VerifyData {
  corrections?: Correction[];
  confidence?: number;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Fetch + unwrap the {success, data, error} envelope every JSON endpoint uses. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, init);

  let envelope: Envelope<T> | null = null;
  try {
    envelope = (await response.json()) as Envelope<T>;
  } catch {
    // non-JSON body (proxy error page, dead backend, ...)
  }

  if (!response.ok || !envelope?.success || envelope.data == null) {
    const message = envelope?.error?.message ?? response.statusText ?? 'Request failed';
    const code = envelope?.error?.code ?? `http_${response.status}`;
    throw new ApiError(code, message);
  }
  return envelope.data;
}

function postJson(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function toNoteData(note: BackendNote): NoteData {
  return {
    id: note.id,
    pitch: note.pitch,
    duration: note.duration,
    startBeat: note.start_beat,
    measure: note.measure,
    velocity: note.velocity ?? 80,
    confidence: note.confidence ?? 1.0,
    theoryCorrected: note.theory_corrected ?? note.llm_corrected ?? false,
    articulation: note.articulation ?? null,
  };
}

function toBackendNote(note: NoteData): BackendNote {
  return {
    id: note.id,
    pitch: note.pitch,
    duration: note.duration,
    start_beat: note.startBeat,
    measure: note.measure,
    velocity: note.velocity,
    confidence: note.confidence,
    theory_corrected: note.theoryCorrected,
  };
}

interface BackendTranscription {
  notes: BackendNote[];
  tempo: number;
  key: string;
  time_signature: string;
  instrument: string;
  title?: string;
}

export const apiClient = {
  uploadAudio: async (file: File): Promise<AudioInfo> => {
    const formData = new FormData();
    formData.append('file', file);

    const data = await request<{
      file_id: string;
      duration_sec: number;
      sample_rate: number;
      format: string;
    }>('/upload', { method: 'POST', body: formData });

    return {
      fileId: data.file_id,
      durationSec: data.duration_sec,
      sampleRate: data.sample_rate,
      format: data.format,
    };
  },

  transcribe: async (
    fileId: string,
    instrument: Instrument,
    options?: { bpm?: number; timeSignature?: string; key?: string },
  ): Promise<TranscriptionData> => {
    const body: Record<string, unknown> = { file_id: fileId, instrument };
    if (options?.bpm) body.bpm = options.bpm;
    if (options?.timeSignature) body.time_signature = options.timeSignature;
    if (options?.key) body.key = options.key;

    const data = await request<BackendTranscription>('/transcribe', postJson(body));

    return {
      notes: data.notes.map(toNoteData),
      tempo: data.tempo,
      key: data.key,
      timeSignature: data.time_signature,
      instrument: data.instrument,
    };
  },

  verifyNotes: async (
    notes: NoteData[],
    instrument: string,
    tempo: number,
    key: string,
  ): Promise<VerifyData> => {
    return request<VerifyData>(
      '/verify',
      postJson({ notes: notes.map(toBackendNote), instrument, tempo, key }),
    );
  },

  exportMusicXml: async (project: Project): Promise<Blob> => {
    const response = await fetch(`${BASE_URL}/export/musicxml`, postJson(project));
    if (!response.ok) throw new ApiError(`http_${response.status}`, `Export failed: ${response.statusText}`);
    return await response.blob();
  },

  importMusicXml: async (file: File): Promise<TranscriptionData & { title: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const data = await request<BackendTranscription>('/import/musicxml', {
      method: 'POST',
      body: formData,
    });
    return {
      notes: data.notes.map(toNoteData),
      title: data.title ?? 'Imported Score',
      tempo: data.tempo,
      key: data.key,
      timeSignature: data.time_signature,
      instrument: data.instrument,
    };
  },
};
