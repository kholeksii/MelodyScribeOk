import React from 'react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { apiClient } from '../../services/apiClient';
import { AudioInfo } from '../../types';
import { useProjectStore } from '../../store/projectStore';
import { useToast } from '../Toast';
import { useT, localizeError } from '../../i18n';

interface RecordButtonProps {
  onUploadComplete: (audioInfo: AudioInfo) => void;
  /** Phone leads with a large primary record action (SPEC.md §5). */
  size?: 'default' | 'large';
}

export const RecordButton: React.FC<RecordButtonProps> = ({ onUploadComplete, size = 'default' }) => {
  const { state, elapsedSec, error, start, stop } = useAudioRecorder();
  const setAudioBlob = useProjectStore((s) => s.setAudioBlob);
  const setAudioFileInfo = useProjectStore((s) => s.setAudioFileInfo);
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
        setAudioFileInfo(t('microphoneRecording'), audioInfo.durationSec);
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
        className={`tap-target rounded-full font-medium transition-all ${
          size === 'large' ? 'min-h-14 w-full px-6 text-base' : 'px-5 py-2.5 text-sm'
        } ${
          state === 'recording'
            ? 'bg-danger hover:opacity-90 text-white animate-pulse'
            : state === 'processing'
              ? 'bg-ink-soft/50 text-white cursor-not-allowed'
              : size === 'large'
                ? 'bg-accent hover:bg-accent-hover text-white'
                : 'bg-ink-soft hover:opacity-90 text-white'
        }`}
      >
        {state === 'idle' && `🎙 ${t('record')}`}
        {state === 'recording' && t('recordingStop', { s: elapsedSec })}
        {state === 'processing' && t('processing')}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
};
