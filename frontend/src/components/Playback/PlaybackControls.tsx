import React, { useEffect, useState } from 'react';
import * as Tone from 'tone';
import { useProjectStore } from '../../store/projectStore';
import { usePlayback } from '../../hooks/usePlayback';

interface PlaybackControlsProps {
  bpm?: number;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({ bpm = 120 }) => {
  const notes = useProjectStore((state) => state.notes);
  const { play, stop, toggleMetronome, isPlaying, isMetronomeEnabled, currentBpm, setCurrentBpm } =
    usePlayback({ bpm, volume: -12 });

  const [bpmInputValue, setBpmInputValue] = useState(String(currentBpm));

  useEffect(() => {
    setBpmInputValue(String(currentBpm));
  }, [currentBpm]);

  // Filter out rests and check if we have playable notes
  const playableNotes = notes.filter((n) => n.pitch !== 'rest');
  const hasNotes = playableNotes.length > 0;

  const handlePlay = () => {
    if (!hasNotes) return;

    // Start AudioContext on user gesture
    Tone.start().then(() => {
      console.log('🔊 AudioContext started');
      play(playableNotes, currentBpm);
    }).catch((err) => {
      console.error('❌ Failed to start AudioContext:', err);
    });
  };

  const handleStop = () => {
    stop();
  };

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

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Transport (left) */}
      <button
        onClick={handlePlay}
        disabled={isPlaying || !hasNotes}
        className="btn-primary"
        title={hasNotes ? 'Play transcription' : 'No playable notes'}
      >
        ▶ Play
      </button>
      <button
        onClick={handleStop}
        disabled={!isPlaying}
        className="btn-secondary"
        title="Stop playback"
      >
        ⏹ Stop
      </button>

      {/* Status */}
      {isPlaying ? (
        <span className="flex items-center gap-2 text-sm font-medium text-valid">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-valid" />
          Playing
        </span>
      ) : (
        <span className="text-sm text-ink-soft">
          {hasNotes ? `${playableNotes.length} note${playableNotes.length !== 1 ? 's' : ''}` : 'No notes'}
        </span>
      )}

      {/* Metronome + BPM (right) */}
      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={toggleMetronome}
          disabled={!isPlaying}
          className={isMetronomeEnabled ? 'btn-primary' : 'btn-secondary'}
          title={isPlaying ? 'Toggle metronome' : 'Start playback to enable metronome'}
        >
          {isMetronomeEnabled ? '🔊' : '🔇'} Metronome
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
          title="Tempo (40-300 BPM)"
        />
      </div>
    </div>
  );
};
