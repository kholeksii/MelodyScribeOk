import React from 'react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { apiClient } from '../../services/apiClient';
import { AudioInfo } from '../../types';
import { useProjectStore } from '../../store/projectStore';
import { useToast } from '../Toast';
import { useT, localizeError } from '../../i18n';

interface RecordButtonProps {
  onUploadComplete: (audioInfo: AudioInfo) => void;
}

export const RecordButton: React.FC<RecordButtonProps> = ({ onUploadComplete }) => {
  const { state, elapsedSec, error, start, stop } = useAudioRecorder();
  const setAudioBlob = useProjectStore((s) => s.setAudioBlob);
  const { showToast } = useToast();
  const t = useT();

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
        showToast(localizeError(err, t) || t('uploadFailed'), 'error');
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
            ? 'bg-danger hover:opacity-90 text-white animate-pulse'
            : state === 'processing'
              ? 'bg-ink-soft/50 text-white cursor-not-allowed'
              : 'bg-ink-soft hover:opacity-90 text-white'
        }`}
      >
        {state === 'idle' && t('record')}
        {state === 'recording' && t('recordingStop', { s: elapsedSec })}
        {state === 'processing' && t('processing')}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
};
