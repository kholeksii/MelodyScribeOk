import JSZip from 'jszip';
import { NoteData, Project } from '../types';
import { useRecentProjectsStore } from '../store/recentProjectsStore';

// .melody files saved before the theoryCorrected rename carry llmCorrected
type StoredNoteData = Omit<NoteData, 'theoryCorrected'> & {
  theoryCorrected?: boolean;
  llmCorrected?: boolean;
};

function normalizeNote(note: StoredNoteData): NoteData {
  const { llmCorrected, theoryCorrected, ...rest } = note;
  return { ...rest, theoryCorrected: theoryCorrected ?? llmCorrected ?? false };
}

export async function saveProject(project: Project, audioBlob: Blob | null, filename?: string): Promise<Blob> {
  useRecentProjectsStore.getState().addRecent(filename ?? project.metadata.title);
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(project, null, 2));
  if (audioBlob) {
    const ext = audioBlob.type.includes('webm') ? 'webm'
      : audioBlob.type.includes('mp4') ? 'm4a'
        : audioBlob.type.includes('mpeg') ? 'mp3'
          : audioBlob.type.includes('ogg') ? 'ogg'
            : audioBlob.type.includes('flac') ? 'flac'
              : 'wav';
    zip.file(`audio.${ext}`, audioBlob);
  }
  return await zip.generateAsync({ type: 'blob' });
}

export async function loadProject(file: File): Promise<{ project: Project; audioBlob: Blob | null }> {
  useRecentProjectsStore.getState().addRecent(file.name);
  const zip = await JSZip.loadAsync(file);

  const projectJson = await zip.file('project.json')?.async('string');
  if (!projectJson) throw new Error('Invalid .melody file: missing project.json');
  const parsed = JSON.parse(projectJson) as Omit<Project, 'notes'> & { notes: StoredNoteData[] };
  const project: Project = { ...parsed, notes: parsed.notes.map(normalizeNote) };

  let audioBlob: Blob | null = null;
  const audioEntry = Object.keys(zip.files).find((name) => name.startsWith('audio.'));
  if (audioEntry) {
    const audioData = await zip.file(audioEntry)!.async('blob');
    audioBlob = audioData;
  }

  return { project, audioBlob };
}
