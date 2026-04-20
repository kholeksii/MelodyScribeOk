import { AudioInfo, Instrument, TranscriptionData, NoteData, Project } from '../types';

const BASE_URL = "http://localhost:8000/api";

export const apiClient = {
  uploadAudio: async (file: File): Promise<AudioInfo> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorBody = await response.json();
        if (errorBody.detail) {
          errorMessage = errorBody.detail;
        }
      } catch {
        // ignore parse errors
      }
      throw new Error(`Upload failed: ${errorMessage}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error('Upload failed');
    }

    const data = result.data;
    return {
      fileId: data.file_id,
      durationSec: data.duration_sec,
      sampleRate: data.sample_rate,
      format: data.format,
    };
  },

  transcribe: async (fileId: string, instrument: Instrument): Promise<TranscriptionData> => {
    const response = await fetch(`${BASE_URL}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_id: fileId, instrument }),
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error('Transcription failed');
    }

    const data = result.data;
    
    // Transform snake_case to camelCase
    const notes: NoteData[] = data.notes.map((note: any) => ({
      id: note.id,
      pitch: note.pitch,
      duration: note.duration,
      startBeat: note.start_beat,
      measure: note.measure,
      velocity: note.velocity,
      confidence: note.confidence,
      llmCorrected: note.llm_corrected,
    }));

    return {
      notes,
      tempo: data.tempo,
      key: data.key,
      timeSignature: data.time_signature,
      instrument: data.instrument,
    };
  },

  verifyNotes: async (notes: NoteData[], instrument: string, tempo: number, key: string): Promise<any> => {
    // Convert camelCase to snake_case for backend
    const backendNotes = notes.map((note) => ({
      id: note.id,
      pitch: note.pitch,
      duration: note.duration,
      start_beat: note.startBeat,
      measure: note.measure,
      velocity: note.velocity,
      confidence: note.confidence,
      llm_corrected: note.llmCorrected,
    }));

    const response = await fetch(`${BASE_URL}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes: backendNotes, instrument, tempo, key }),
    });

    if (!response.ok) {
      throw new Error(`Verification failed: ${response.statusText}`);
    }

    return await response.json();
  },

  exportPdf: async (project: Project): Promise<Blob> => {
    const response = await fetch(`${BASE_URL}/export/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(project),
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return await response.blob();
  },
};