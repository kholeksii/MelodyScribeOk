import React, { useEffect, useState } from 'react';
import * as Tone from 'tone';
import { useProjectStore } from '../../store/projectStore';
import { usePlayback } from '../../hooks/usePlayback';
import { useTapTempo } from '../../hooks/useTapTempo';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { BottomSheet } from '../ui/BottomSheet';
import { useT } from '../../i18n';

interface PlaybackControlsProps {
  bpm?: number;
  undo?: () => void;
  redo?: () => void;
  canUndo?: () => boolean;
  canRedo?: () => boolean;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  bpm = 120,
  undo,
  redo,
  canUndo,
  canRedo,
}) => {
  const isTabletUp = useMediaQuery('(min-width: 640px)');
  const notes = useProjectStore((state) => state.notes);
  const { play, stop, toggleMetronome, isPlaying, isMetronomeEnabled, currentBpm, setCurrentBpm } =
    usePlayback({ bpm, volume: -12 });

  const [bpmInputValue, setBpmInputValue] = useState(String(currentBpm));
  const [bpmSheetOpen, setBpmSheetOpen] = useState(false);
  const t = useT();

  const commitBpmValue = (raw: string) => {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) setCurrentBpm(Math.max(40, Math.min(300, parsed)));
  };
  const { tap, tapCount, computedBpm } = useTapTempo(commitBpmValue);

  useEffect(() => {
    setBpmInputValue(String(currentBpm));
  }, [currentBpm]);

  // Filter out rests and check if we have playable notes
  const playableNotes = notes.filter((n) => n.pitch !== 'rest');
  const hasNotes = playableNotes.length > 0;

  const handlePlay = () => {
    if (!hasNotes) return;
    Tone.start().then(() => {
      play(playableNotes, currentBpm);
    }).catch((err) => {
      console.error('❌ Failed to start AudioContext:', err);
    });
  };

  const handleStop = () => {
    stop();
  };

  // Space = play/stop (U18); guarded against inputs, buttons and page scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.tagName === 'BUTTON' ||
          el.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      if (isPlaying) {
        stop();
      } else {
        handlePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlePlay closes over notes/bpm; rebind on playback state
  }, [isPlaying, hasNotes, currentBpm, notes]);

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 300) {
      setBpmInputValue('300');
    } else {
      setBpmInputValue(raw);
    }
  };

  const commitBpm = () => {
    const parsed = parseInt(bpmInputValue, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(40, Math.min(300, parsed));
      setCurrentBpm(clamped);
      setBpmInputValue(String(clamped));
    } else {
      setBpmInputValue(String(currentBpm));
    }
  };

  const tapButton = (
    <button
      type="button"
      onClick={tap}
      className="btn-secondary"
      title={t('tapHint')}
    >
      {tapCount === 0 ? t('tapTempo') : tapCount < 4 ? t('tapProgress', { n: tapCount }) : `BPM: ${computedBpm}`}
    </button>
  );

  if (!isTabletUp) {
    return (
      <div
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center gap-1">
          <button onClick={undo} disabled={!canUndo?.()} title={t('undoTitle')} className="btn-ghost" aria-label={t('undo')}>
            ↩
          </button>
          <button onClick={redo} disabled={!canRedo?.()} title={t('redoTitle')} className="btn-ghost" aria-label={t('redo')}>
            ↪
          </button>
        </div>

        <button
          onClick={isPlaying ? handleStop : handlePlay}
          disabled={!hasNotes && !isPlaying}
          title={isPlaying ? t('stopTitle') : hasNotes ? t('playTitle') : t('noPlayableNotes')}
          aria-label={isPlaying ? t('stop') : t('play')}
          className="flex h-14 w-14 items-center justify-center justify-self-center rounded-full bg-accent text-xl text-white shadow-md transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPlaying ? '⏹' : '▶'}
        </button>

        <div className="flex items-center justify-end gap-2">
          {isPlaying ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-valid">
              <span className="h-2 w-2 animate-pulse rounded-full bg-valid" />
              {t('playing')}
            </span>
          ) : (
            <button
              onClick={() => setBpmSheetOpen(true)}
              title={t('bpmTitle')}
              className="tap-target rounded-full border border-ink-soft/20 bg-surface/60 px-2.5 py-0.5 text-xs font-semibold text-ink-soft"
            >
              {currentBpm} BPM
            </button>
          )}
          <button
            onClick={toggleMetronome}
            disabled={!isPlaying}
            title={isPlaying ? t('metronomeTitle') : t('metronomeDisabledTitle')}
            className="btn-ghost"
            aria-label={t('metronome')}
          >
            {isMetronomeEnabled ? '🔊' : '🔇'}
          </button>
        </div>

        <BottomSheet open={bpmSheetOpen} onClose={() => setBpmSheetOpen(false)} title={t('bpmTitle')}>
          <div className="space-y-4 px-4 pt-1">
            <input
              type="range"
              min={40}
              max={220}
              value={currentBpm}
              onChange={(e) => setCurrentBpm(Number(e.target.value))}
              className="w-full"
              aria-label={t('bpmTitle')}
            />
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setCurrentBpm(Math.max(40, currentBpm - 1))}
                className="btn-secondary tap-target"
                aria-label="−1 BPM"
              >
                −
              </button>
              <span className="w-20 text-center text-lg font-semibold text-ink">{currentBpm} BPM</span>
              <button
                onClick={() => setCurrentBpm(Math.min(300, currentBpm + 1))}
                className="btn-secondary tap-target"
                aria-label="+1 BPM"
              >
                +
              </button>
            </div>
            <div className="flex justify-center">{tapButton}</div>
            <label className="flex items-center justify-between rounded-md border border-ink-soft/20 px-3 py-2.5">
              <span className="text-sm text-ink">{t('metronome')}</span>
              <input
                type="checkbox"
                checked={isMetronomeEnabled}
                onChange={toggleMetronome}
                disabled={!isPlaying}
                className="h-5 w-5 accent-accent"
              />
            </label>
            <button onClick={() => setBpmSheetOpen(false)} className="btn-primary w-full justify-center">
              {t('done')}
            </button>
          </div>
        </BottomSheet>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Transport (left) */}
      <button
        onClick={handlePlay}
        disabled={isPlaying || !hasNotes}
        className="btn-primary"
        title={hasNotes ? t('playTitle') : t('noPlayableNotes')}
      >
        ▶ {t('play')}
      </button>
      <button
        onClick={handleStop}
        disabled={!isPlaying}
        className="btn-secondary"
        title={t('stopTitle')}
      >
        ⏹ {t('stop')}
      </button>

      {/* Status */}
      {isPlaying ? (
        <span className="flex items-center gap-2 text-sm font-medium text-valid">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-valid" />
          {t('playing')}
        </span>
      ) : (
        <span className="text-sm text-ink-soft">
          {hasNotes ? t('notesCount', { n: playableNotes.length }) : t('noNotes')}
        </span>
      )}

      {/* Metronome + BPM (right) */}
      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={toggleMetronome}
          disabled={!isPlaying}
          className={isMetronomeEnabled ? 'btn-primary' : 'btn-secondary'}
          title={isPlaying ? t('metronomeTitle') : t('metronomeDisabledTitle')}
        >
          {isMetronomeEnabled ? '🔊' : '🔇'} {t('metronome')}
        </button>
        <label htmlFor="bpm-input" className="text-sm font-medium text-ink-soft">
          BPM
        </label>
        <input
          id="bpm-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={bpmInputValue}
          onChange={handleBpmChange}
          onBlur={commitBpm}
          onKeyDown={(e) => e.key === 'Enter' && commitBpm()}
          className="input-field w-16 text-center font-semibold text-accent"
          title={t('bpmTitle')}
        />
        {tapButton}
      </div>
    </div>
  );
};
