import { useRef } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useRecentProjectsStore } from '../store/recentProjectsStore';
import { saveProject, loadProject } from '../services/projectFile';
import { clearAutosave } from '../services/autosave';
import { getElectronAPI, basename } from '../services/electronBridge';
import { Project } from '../types';
import { useT } from '../i18n';

/** Save/open project-file handlers shared by the Toolbar (upload screen) and
 * the editor header's File menu, so both stay wired to the same logic. */
export function useProjectFileActions() {
  const t = useT();
  const notes = useProjectStore((s) => s.notes);
  const metadata = useProjectStore((s) => s.metadata);
  const audioBlob = useProjectStore((s) => s.audioBlob);
  const loadFromProject = useProjectStore((s) => s.loadFromProject);
  const addRecent = useRecentProjectsStore((s) => s.addRecent);
  const openFileRef = useRef<HTMLInputElement>(null);

  const canSave = Boolean(metadata && notes.length);

  const handleSave = async () => {
    if (!metadata) return;
    const project: Project = { version: '1.0', metadata, notes };
    const filename = `${metadata.title.replace(/\s+/g, '_')}.melody`;
    const blob = await saveProject(project, audioBlob);

    const api = getElectronAPI();
    if (api) {
      // Native save dialog gives us the absolute path for clickable recents
      const savedPath = await api.saveProjectFile(filename, new Uint8Array(await blob.arrayBuffer()));
      if (savedPath) {
        addRecent(basename(savedPath), savedPath);
        clearAutosave();
      }
      return; // dialog canceled — keep the autosave
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addRecent(filename);
    // Explicitly saved — the autosaved working copy is no longer needed
    clearAutosave();
  };

  const openLoadedFile = async (file: File, path: string | null) => {
    try {
      const { project, audioBlob: ab } = await loadProject(file);
      loadFromProject(project, ab);
      addRecent(file.name, path);
    } catch (err) {
      alert(err instanceof Error ? err.message : t('openFailed'));
    }
  };

  const handleOpenClick = async () => {
    const api = getElectronAPI();
    if (!api) {
      openFileRef.current?.click();
      return;
    }
    const result = await api.openProjectFile();
    if (!result) return;
    await openLoadedFile(new File([result.data as BlobPart], basename(result.path)), result.path);
  };

  const handleOpenFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await openLoadedFile(file, null);
    if (openFileRef.current) openFileRef.current.value = '';
  };

  return { canSave, handleSave, handleOpenClick, handleOpenFile, openFileRef };
}
