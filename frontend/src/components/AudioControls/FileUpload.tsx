import React, { useState, useCallback } from 'react';
import { apiClient } from '../../services/apiClient';
import { AudioInfo } from '../../types';
import { RecordButton } from './RecordButton';
import { useProjectStore } from '../../store/projectStore';
import { useT, localizeError } from '../../i18n';

interface FileUploadProps {
  onUploadComplete: (audioInfo: AudioInfo) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const setAudioBlob = useProjectStore((state) => state.setAudioBlob);
  const t = useT();

  const handleFile = useCallback(async (file: File) => {
    // Validate file type
    const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/flac', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'];
    const allowedExtensions = ['.wav', '.mp3', '.flac', '.ogg', '.m4a'];

    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const isValidType = allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension);

    if (!isValidType) {
      setError(t('unsupportedFormat'));
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const audioInfo = await apiClient.uploadAudio(file);
      setAudioBlob(file);
      onUploadComplete(audioInfo);
    } catch (err) {
      setError(localizeError(err, t) || t('uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  }, [onUploadComplete, setAudioBlob, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-accent bg-accent/10'
            : 'border-ink-soft/30 hover:border-ink-soft/60'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isUploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mb-2"></div>
            <p className="text-ink-soft">{t('uploading')}</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-ink-soft/60"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="mb-4">
              <p className="text-lg font-medium text-ink mb-1">
                {t('uploadTitle')}
              </p>
              <p className="text-sm text-ink-soft">
                {t('uploadHint')}
              </p>
            </div>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
            >
              {t('chooseFile')}
            </label>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-ink-soft/30" />
        <span className="text-xs text-ink-soft/60 uppercase">{t('or')}</span>
        <div className="flex-1 h-px bg-ink-soft/30" />
      </div>

      <RecordButton onUploadComplete={onUploadComplete} />

      {error && (
        <div className="mt-4 p-3 bg-danger/10 border border-danger/30 rounded-md">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}
    </div>
  );
};