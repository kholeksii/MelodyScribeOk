import React from 'react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { apiClient } from '../../services/apiClient';
import { AudioInfo } from '../../types';
import { useProjectStore } from '../../store/projectStore';

interface RecordButtonProps {
  onUploadComplete: (audioInfo: AudioInfo) => void;
}

export const RecordButton: React.FC<RecordButtonProps> = ({ onUploadComplete }) => {
  const { state, elapsedSec, error, start, stop } = useAudioRecorder();
  const setAudioBlob = useProjectStore((s) => s.setAudioBlob);

  const handleClick = async () => {
    if (state === 'idle') {
      await start();
    } else if (state === 'recording') {
      const blob = await stop();
      try {
        setAudioBlob(blob);
        const file = new File([blob], 'recording.webm', { type: 'audio/webm' });
        const audioInfo = await apiClient.uploadAudio(file);
        onUploadComplete(audioInfo);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Upload failed');
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={handleClick}
        disabled={state === 'processing'}
        className={`px-5 py-2.5 rounded-full font-medium text-sm transition-all ${
          state === 'recording'
            ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
            : state === 'processing'
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-gray-600 hover:bg-gray-700 text-white'
        }`}
      >
        {state === 'idle' && 'Record'}
        {state === 'recording' && `${elapsedSec}s — click to stop`}
        {state === 'processing' && 'Processing...'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};
