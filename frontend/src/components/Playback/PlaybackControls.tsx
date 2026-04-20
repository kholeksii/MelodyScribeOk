import React, { useEffect } from 'react';
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
    const newBpm = Math.max(40, Math.min(300, parseInt(e.target.value, 10) || bpm));
    setCurrentBpm(newBpm);
  };

  return (
    <div className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Play Button */}
        <button
          onClick={handlePlay}
          disabled={isPlaying || !hasNotes}
          className={`px-6 py-2.5 rounded-lg font-semibold transition flex items-center gap-2 ${
            isPlaying || !hasNotes
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white'
          }`}
          title={hasNotes ? 'Play transcription' : 'No playable notes'}
        >
          ▶️
          <span>Play</span>
        </button>

        {/* Stop Button */}
        <button
          onClick={handleStop}
          disabled={!isPlaying}
          className={`px-6 py-2.5 rounded-lg font-semibold transition flex items-center gap-2 ${
            !isPlaying
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white'
          }`}
          title="Stop playback"
        >
          ⏹️
          <span>Stop</span>
        </button>

        {/* Metronome Toggle */}
        <button
          onClick={toggleMetronome}
          disabled={!isPlaying}
          className={`px-6 py-2.5 rounded-lg font-semibold transition flex items-center gap-2 ${
            isMetronomeEnabled
              ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
              : 'bg-gray-400 hover:bg-gray-500 active:bg-gray-600 text-white'
          } ${!isPlaying && 'opacity-50 cursor-not-allowed'}`}
          title={isPlaying ? 'Toggle metronome' : 'Start playback to enable metronome'}
        >
          {isMetronomeEnabled ? '🔊' : '🔇'}
          <span>Metronome</span>
        </button>

        {/* BPM Display */}
        <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-purple-300">
          <label htmlFor="bpm-input" className="text-sm font-semibold text-gray-700">
            BPM:
          </label>
          <input
            id="bpm-input"
            type="number"
            min="40"
            max="300"
            value={currentBpm}
            onChange={handleBpmChange}
            className="w-16 text-center font-semibold text-purple-600 border-0 focus:outline-none focus:ring-2 focus:ring-purple-400 rounded"
            title="Tempo (40-300 BPM)"
          />
        </div>

        {/* Status Indicator */}
        <div className="ml-auto flex items-center gap-2">
          {isPlaying ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-700">Playing</span>
            </div>
          ) : (
            <span className="text-sm font-medium text-gray-600">
              {hasNotes ? `${playableNotes.length} note${playableNotes.length !== 1 ? 's' : ''}` : 'No notes'}
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="mt-3 text-xs text-purple-700 bg-white bg-opacity-50 rounded px-2 py-1">
        <p>💡 Use the metronome to stay in time with the recording</p>
      </div>
    </div>
  );
};
