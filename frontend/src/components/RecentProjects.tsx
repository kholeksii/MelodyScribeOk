import React from 'react';
import { useProjectStore } from '../store/projectStore';
import { useRecentProjectsStore, RecentProject } from '../store/recentProjectsStore';
import { useUiStore } from '../store/uiStore';
import { loadProject } from '../services/projectFile';
import { getElectronAPI } from '../services/electronBridge';
import { relativeTime } from '../utils/relativeTime';
import { useT } from '../i18n';
import { useToast } from './Toast';

/**
 * Recent projects on the empty upload screen (U20). Entries with a stored
 * absolute path open on click via Electron IPC; browser-saved entries stay
 * plain text with the "Open" hint.
 */
export const RecentProjects: React.FC = () => {
  const t = useT();
  const language = useUiStore((s) => s.language);
  const { showToast } = useToast();
  const recents = useRecentProjectsStore((s) => s.recents);
  const addRecent = useRecentProjectsStore((s) => s.addRecent);
  const removeRecent = useRecentProjectsStore((s) => s.removeRecent);
  const loadFromProject = useProjectStore((s) => s.loadFromProject);

  if (recents.length === 0) return null;

  const api = getElectronAPI();

  const openRecent = async (entry: RecentProject) => {
    if (!api || !entry.path) return;
    const result = await api.readProjectFile(entry.path);
    if (!result.ok) {
      if (result.error === 'not_found') {
        showToast(t('fileNotFound'), 'error');
        removeRecent(entry);
      } else {
        showToast(t('openFailed'), 'error');
      }
      return;
    }
    try {
      const file = new File([result.data as BlobPart], entry.name);
      const { project, audioBlob } = await loadProject(file);
      loadFromProject(project, audioBlob);
      addRecent(entry.name, entry.path); // bump to the top
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('openFailed'), 'error');
    }
  };

  return (
    <div className="mb-6 text-left max-w-md mx-auto">
      <p className="text-sm font-semibold text-ink mb-2">{t('recentProjects')}</p>
      <ul className="space-y-1">
        {recents.map((r) => {
          const clickable = !!(api && r.path);
          const row = (
            <>
              <span className="truncate">{r.name}</span>
              <span className="ml-3 text-ink-soft/60 shrink-0">
                {relativeTime(r.savedAt, language, t)}
              </span>
            </>
          );
          return (
            <li key={(r.path ?? r.name) + r.savedAt} className="border-b border-ink-soft/10 pb-1">
              {clickable ? (
                <button
                  onClick={() => openRecent(r)}
                  title={t('openRecentTitle', { name: r.name })}
                  className="flex w-full justify-between rounded px-1 py-0.5 text-left text-sm text-ink transition hover:bg-paper-dark"
                >
                  {row}
                </button>
              ) : (
                <div className="flex justify-between px-1 py-0.5 text-sm text-ink-soft">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
      {!api && <p className="text-xs text-ink-soft/60 mt-1">{t('recentHint')}</p>}
    </div>
  );
};
