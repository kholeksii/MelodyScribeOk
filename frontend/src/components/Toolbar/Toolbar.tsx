import React, { useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { saveProject, loadProject } from '../../services/projectFile';
import { Project } from '../../types';

export const Toolbar: React.FC = () => {
  const notes = useProjectStore((s) => s.notes);
  const metadata = useProjectStore((s) => s.metadata);
  const audioBlob = useProjectStore((s) => s.audioBlob);
  const loadFromProject = useProjectStore((s) => s.loadFromProject);
  const openFileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!metadata) return;
    const project: Project = { version: '1.0', metadata, notes };
    const filename = `${metadata.title.replace(/\s+/g, '_')}.melody`;
    const blob = await saveProject(project, audioBlob, filename);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { project, audioBlob: ab } = await loadProject(file);
      loadFromProject(project, ab);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to open project');
    } finally {
      if (openFileRef.current) openFileRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSave}
        disabled={!metadata || !notes.length}
        className="btn-secondary"
        title="Save project as .melody file"
      >
        Save
      </button>
      <button
        onClick={() => openFileRef.current?.click()}
        className="btn-secondary"
        title="Open a .melody project file"
      >
        Open
      </button>
      <input
        ref={openFileRef}
        type="file"
        accept=".melody"
        className="hidden"
        onChange={handleOpenFile}
      />
    </div>
  );
};

export default Toolbar;
