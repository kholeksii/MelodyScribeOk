import { useEffect, useState } from 'react';
import { NotationDisplay } from './NotationEditor/NotationDisplay';
import { NoteToolbar } from './NotationEditor/NoteToolbar';
import { PlaybackControls } from './Playback/PlaybackControls';
import { WaveformDisplay } from './WaveformDisplay';
import { ShortcutHelp } from './ShortcutHelp';
import { EditorHeader } from './EditorHeader';
import { useProjectStore } from '../store/projectStore';
import { useKeyboardEditing } from '../hooks/useKeyboardEditing';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useT } from '../i18n';

export const EditorScreen: React.FC = () => {
  const [showWaveform, setShowWaveform] = useState(true);
  const t = useT();
  const isTabletUp = useMediaQuery('(min-width: 640px)');
  const { helpVisible, setHelpVisible } = useKeyboardEditing();
  const { notes, metadata, selectedNoteId, undo, redo } = useProjectStore();
  // Phone's note-edit sheet covers the bottom of the screen — hide the
  // playback bar underneath it while it's open (SPEC.md §4).
  const hidePlaybackBar = !isTabletUp && Boolean(selectedNoteId);

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

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <ShortcutHelp visible={helpVisible} onClose={() => setHelpVisible(false)} />
      <EditorHeader onOpenShortcuts={() => setHelpVisible(true)} />

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
      {!hidePlaybackBar && (
        <footer className="sticky bottom-0 z-30 border-t border-ink-soft/15 bg-paper-dark/95 shadow-sm backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
            <PlaybackControls bpm={metadata?.tempo || 120} />
          </div>
        </footer>
      )}
    </div>
  );
};
