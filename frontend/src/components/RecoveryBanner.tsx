import React, { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useUiStore } from '../store/uiStore';
import { readAutosave, clearAutosave, AutosaveData } from '../services/autosave';
import { relativeTime } from '../utils/relativeTime';
import { useT } from '../i18n';
import { useToast } from './Toast';

/**
 * Offers to restore the autosaved session (U19). Rendered only on the empty
 * upload screen, so the store is guaranteed to have nothing to overwrite.
 */
export const RecoveryBanner: React.FC = () => {
  const t = useT();
  const language = useUiStore((s) => s.language);
  const { showToast } = useToast();
  const [autosave, setAutosave] = useState<AutosaveData | null>(() => readAutosave());
  const setNotes = useProjectStore((s) => s.setNotes);
  const setMetadata = useProjectStore((s) => s.setMetadata);
  const setAudioFileId = useProjectStore((s) => s.setAudioFileId);

  if (!autosave) return null;

  const handleRestore = () => {
    setNotes(autosave.notes);
    setMetadata(autosave.metadata);
    setAudioFileId(autosave.audioFileId);
    setAutosave(null);
    // The audio blob is never autosaved; the waveform needs a re-upload
    showToast(t('recoveryAudioHint'), 'info', 6000);
  };

  const handleDiscard = () => {
    clearAutosave();
    setAutosave(null);
  };

  return (
    <div className="mx-auto mb-6 flex max-w-md flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent/5 p-4 text-left">
      <div>
        <p className="text-sm font-semibold text-ink">{t('recoveryPrompt')}</p>
        <p className="mt-0.5 text-xs text-ink-soft">
          {t('recoveryDetail', {
            title: autosave.metadata?.title || t('untitled'),
            notes: autosave.notes.length,
            when: relativeTime(autosave.savedAt, language, t),
          })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={handleRestore} className="btn-primary">
          {t('restore')}
        </button>
        <button onClick={handleDiscard} className="btn-ghost">
          {t('discard')}
        </button>
      </div>
    </div>
  );
};
