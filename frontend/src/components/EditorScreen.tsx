import { useEffect, useState } from 'react';
import { Toolbar } from './Toolbar/Toolbar';
import { NotationDisplay } from './NotationEditor/NotationDisplay';
import { NoteToolbar } from './NotationEditor/NoteToolbar';
import { PlaybackControls } from './Playback/PlaybackControls';
import { ExportButton } from './ExportButton';
import { WaveformDisplay } from './WaveformDisplay';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { ShortcutHelp } from './ShortcutHelp';
import { useProjectStore } from '../store/projectStore';
import { useKeyboardEditing } from '../hooks/useKeyboardEditing';
import { clearAutosave } from '../services/autosave';
import { useT, instrumentLabel } from '../i18n';

export const EditorScreen: React.FC = () => {
  const [showWaveform, setShowWaveform] = useState(true);
  const t = useT();
  const { helpVisible, setHelpVisible } = useKeyboardEditing();
  const {
    notes,
    metadata,
    selectedNoteId,
    setNotes,
    setMetadata,
    setAudioFileId,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useProjectStore();

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Shift+Z = redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const handleNewTranscription = () => {
    setNotes([]);
    setMetadata(null);
    setAudioFileId(null);
    clearAutosave();
  };

  const chips = metadata
    ? [instrumentLabel(metadata.instrument, t), `♩ = ${metadata.tempo}`, metadata.key, metadata.timeSignature]
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <ShortcutHelp visible={helpVisible} onClose={() => setHelpVisible(false)} />
      {/* Top bar: title, metadata chips, project actions */}
      <header className="sticky top-0 z-30 border-b border-ink-soft/15 bg-paper-dark/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <h1 className="shrink-0 text-xl font-bold text-ink">MelodyScribe</h1>
          <input
            value={metadata?.title ?? ''}
            onChange={(e) => metadata && setMetadata({ ...metadata, title: e.target.value })}
            aria-label={t('projectTitle')}
            placeholder={t('untitled')}
            className="input-field w-52 font-heading"
          />
          <div className="flex items-center gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip}
                className="whitespace-nowrap rounded-full border border-ink-soft/20 bg-surface/60 px-2.5 py-0.5 text-xs text-ink-soft"
              >
                {chip}
              </span>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button onClick={undo} disabled={!canUndo()} title={t('undoTitle')} className="btn-ghost">
              ↩ {t('undo')}
            </button>
            <button onClick={redo} disabled={!canRedo()} title={t('redoTitle')} className="btn-ghost">
              ↪ {t('redo')}
            </button>
            <Toolbar />
            <ExportButton />
            <button onClick={handleNewTranscription} title={t('newProjectTitle')} className="btn-ghost">
              {t('newProject')}
            </button>
            <button
              onClick={() => setHelpVisible(true)}
              title={t('shortcutsHintTitle')}
              className="btn-ghost"
            >
              ?
            </button>
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Main: the score is the hero */}
      <main className="mx-auto w-full max-w-[900px] flex-1 px-4 py-8">
        {selectedNoteId && (
          <div className="sticky top-20 z-20 mb-4">
            <NoteToolbar />
          </div>
        )}
        <div className="rounded-lg border border-ink-soft/15 bg-paper-dark p-6 shadow-sm sm:p-8">
          <NotationDisplay
            notes={notes}
            timeSignature={metadata?.timeSignature || '4/4'}
            keySignature={metadata?.key || 'C'}
          />
        </div>
        <div className="mt-4">
          <button
            onClick={() => setShowWaveform((v) => !v)}
            title={t('waveformToggleTitle')}
            className={`btn-ghost text-xs ${showWaveform ? 'bg-paper-dark text-ink' : ''}`}
          >
            〰 {t('waveform')}
          </button>
          {showWaveform && (
            <div className="mt-2">
              <WaveformDisplay notes={notes} tempo={metadata?.tempo || 120} />
            </div>
          )}
        </div>
      </main>

      {/* Bottom bar: playback transport */}
      <footer className="sticky bottom-0 z-30 border-t border-ink-soft/15 bg-paper-dark/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <PlaybackControls bpm={metadata?.tempo || 120} />
        </div>
      </footer>
    </div>
  );
};
