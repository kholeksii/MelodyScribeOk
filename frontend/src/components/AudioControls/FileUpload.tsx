import React, { useState, useCallback } from 'react';
import { AudioInfo } from '../../types';
import { useAudioUpload } from '../../hooks/useAudioUpload';
import { useT } from '../../i18n';

interface FileUploadProps {
  onUploadComplete: (audioInfo: AudioInfo) => void;
  /** Shorter copy for the phone tier, where the record button already leads (SPEC.md §5). */
  compact?: boolean;
}

/** The drag-and-drop / click-to-choose dropzone. Composed alongside
 * `RecordButton` by the caller — their relative order changes per tier
 * (SPEC.md §5), so this component no longer bundles the "or" divider. */
export const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete, compact = false }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const { handleFile, isUploading, error } = useAudioUpload(onUploadComplete);
  const t = useT();

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
    <div className="w-full">
      <div
        className={`rounded-lg border-2 border-dashed text-center transition-colors ${
          compact ? 'p-6' : 'p-8'
        } ${
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
            {!compact && (
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
            )}
            <div className="mb-4">
              {!compact && <p className="text-lg font-medium text-ink mb-1">{t('uploadTitle')}</p>}
              <p className="text-sm text-ink-soft">{compact ? t('uploadHintCompact') : t('uploadHint')}</p>
            </div>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="btn-primary tap-target cursor-pointer">
              {t('chooseFile')}
            </label>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-danger/10 border border-danger/30 rounded-md">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}
    </div>
  );
};
