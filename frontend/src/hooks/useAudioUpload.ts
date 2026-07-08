import { useCallback, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { AudioInfo } from '../types';
import { useProjectStore } from '../store/projectStore';
import { useT, localizeError } from '../i18n';

const ALLOWED_TYPES = [
  'audio/wav',
  'audio/mpeg',
  'audio/flac',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
];
const ALLOWED_EXTENSIONS = ['.wav', '.mp3', '.flac', '.ogg', '.m4a'];

/** True when the file looks like an audio format the backend accepts. */
export function isSupportedAudio(file: File): boolean {
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
  return ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Shared audio-upload pipeline used by FileUpload's drop zone, the App-level
 * full-window drag-and-drop and the demo button (U23). Validates the file,
 * uploads it, stores the blob and reports the resulting AudioInfo.
 */
export function useAudioUpload(onUploadComplete: (info: AudioInfo) => void) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAudioBlob = useProjectStore((state) => state.setAudioBlob);
  const t = useT();

  const handleFile = useCallback(
    async (file: File): Promise<AudioInfo | null> => {
      if (!isSupportedAudio(file)) {
        setError(t('unsupportedFormat'));
        return null;
      }
      setIsUploading(true);
      setError(null);
      try {
        const audioInfo = await apiClient.uploadAudio(file);
        setAudioBlob(file);
        onUploadComplete(audioInfo);
        return audioInfo;
      } catch (err) {
        setError(localizeError(err, t) || t('uploadFailed'));
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [onUploadComplete, setAudioBlob, t],
  );

  return { handleFile, isUploading, error, setError };
}
