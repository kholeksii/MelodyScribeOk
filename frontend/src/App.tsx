import { useState, useEffect, useRef } from 'react';
import { FileUpload } from './components/AudioControls/FileUpload';
import { RecordButton } from './components/AudioControls/RecordButton';
import { InstrumentSelector } from './components/AudioControls/InstrumentSelector';
import { TranscribeOptions } from './components/AudioControls/TranscribeOptions';
import { EditorScreen } from './components/EditorScreen';
import { useProjectStore } from './store/projectStore';
import { useToast } from './components/Toast';
import { Tour } from './components/Tour';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ThemeToggle } from './components/ThemeToggle';
import { RecoveryBanner } from './components/RecoveryBanner';
import { RecentProjects } from './components/RecentProjects';
import { VersionBadge } from './components/VersionBadge';
import { apiClient } from './services/apiClient';
import { startAutosave } from './services/autosave';
import { useApplyTheme } from './hooks/useTheme';
import { useAudioUpload } from './hooks/useAudioUpload';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useProjectFileActions } from './hooks/useProjectFileActions';
import { useT, localizeError, instrumentLabel } from './i18n';
import { AudioInfo, Instrument, TranscriptionData } from './types';
import demoAudioUrl from './assets/demo-do-mi-re-do.wav?url';

function App() {
  const [instrument, setInstrument] = useState<Instrument>('violin');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [isWindowDragOver, setIsWindowDragOver] = useState(false);
  const [optBpm, setOptBpm] = useState('');
  // '' = auto-detect meter on the backend (U31)
  const [optTimeSignature, setOptTimeSignature] = useState('');
  const [optKey, setOptKey] = useState('');
  const { showToast } = useToast();
  const t = useT();
  const isTabletUp = useMediaQuery('(min-width: 640px)');
  const isDesktopUp = useMediaQuery('(min-width: 1024px)');
  const { handleOpenClick, handleOpenFile, openFileRef } = useProjectFileActions();

  const {
    notes,
    audioFileId,
    error,
    setNotes,
    setMetadata,
    setAudioFileId,
    setLoading,
    setError,
  } = useProjectStore();

  // Autosave the working session 2s after any notes/metadata change (U19)
  useEffect(() => startAutosave(), []);

  // Dark mode: keep the .dark class on <html> in sync (U22)
  useApplyTheme();

  const handleUploadComplete = (audioInfo: AudioInfo) => {
    setAudioFileId(audioInfo.fileId);
    setError(null);
  };

  // Shared upload pipeline for full-window drag-and-drop and the demo (U23)
  const { handleFile } = useAudioUpload(handleUploadComplete);
  const dragCounter = useRef(0);

  const runTranscribe = async (fileId: string) => {
    setIsTranscribing(true);
    setLoading(true);
    setError(null);

    try {
      const options: { bpm?: number; timeSignature?: string; key?: string } = {};
      if (optBpm) options.bpm = Number(optBpm);
      if (optTimeSignature) options.timeSignature = optTimeSignature;
      if (optKey) options.key = optKey;
      const result: TranscriptionData = await apiClient.transcribe(fileId, instrument, options);
      setNotes(result.notes);
      setMetadata({
        title: `${t('transcription')} — ${instrumentLabel(instrument, t)}`,
        instrument,
        tempo: result.tempo,
        timeSignature: result.timeSignature,
        key: result.key,
        // «(авто)» suffix on the meter chip when U31 detected it (U35)
        timeSignatureAuto: result.timeSignatureConfidence != null,
      });
    } catch (err) {
      const msg = localizeError(err, t) || t('transcriptionFailed');
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsTranscribing(false);
      setLoading(false);
    }
  };

  const handleTranscribe = () => {
    if (audioFileId) runTranscribe(audioFileId);
  };

  // Full-window drag-and-drop: any audio dropped over the empty state uploads
  const handleWindowDragEnter = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    dragCounter.current += 1;
    setIsWindowDragOver(true);
  };

  const handleWindowDragOver = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault();
  };

  const handleWindowDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsWindowDragOver(false);
    }
  };

  const handleWindowDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsWindowDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // One-click demo: bundled melody through the real upload+transcribe pipeline
  const handleTryDemo = async () => {
    setIsDemoLoading(true);
    setError(null);
    try {
      const res = await fetch(demoAudioUrl);
      const blob = await res.blob();
      const file = new File([blob], 'demo-do-mi-re-do.wav', { type: 'audio/wav' });
      const info = await handleFile(file);
      if (info) await runTranscribe(info.fileId);
    } catch (err) {
      const msg = localizeError(err, t) || t('uploadFailed');
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsDemoLoading(false);
    }
  };

  // Post-transcription editor takes over the whole window (own top/bottom bars)
  if (notes.length > 0) {
    return (
      <>
        <Tour />
        <EditorScreen />
      </>
    );
  }

  const demoButton = (
    <button
      onClick={handleTryDemo}
      disabled={isDemoLoading || isTranscribing}
      className="btn-ghost text-sm"
    >
      {isDemoLoading ? `⟳ ${t('demoLoading')}` : `🎹 ${t('tryDemo')}`}
    </button>
  );

  const optionsAndInstrument = (
    <div className="flex w-full flex-col items-center gap-4">
      <InstrumentSelector value={instrument} onChange={setInstrument} />
      <TranscribeOptions
        bpm={optBpm}
        setBpm={setOptBpm}
        timeSignature={optTimeSignature}
        setTimeSignature={setOptTimeSignature}
        musicalKey={optKey}
        setMusicalKey={setOptKey}
      />
    </div>
  );

  const errorBlock = error && (
    <div className="mt-6 w-full rounded-md border border-danger/30 bg-danger/10 p-4">
      <p className="text-sm text-danger">{error}</p>
    </div>
  );

  const transcribeButton = audioFileId && (
    <button
      onClick={handleTranscribe}
      disabled={isTranscribing}
      className="btn-primary tap-target w-full justify-center px-6 text-base"
    >
      {isTranscribing ? t('transcribing') : t('transcribe')}
    </button>
  );

  let content: React.ReactNode;
  if (!isTabletUp) {
    // Phone: record leads, dropzone with compact copy, sticky Transcribe above the safe area
    content = (
      <div className="flex w-full flex-col items-center gap-4 pb-24 text-center">
        <RecoveryBanner />
        <RecordButton onUploadComplete={handleUploadComplete} size="large" />
        <FileUpload onUploadComplete={handleUploadComplete} compact />
        {demoButton}
        {optionsAndInstrument}
        {errorBlock}
        <RecentProjects />
        {transcribeButton && (
          <div
            className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-soft/15 bg-paper-dark/95 px-4 py-3 shadow-sm backdrop-blur"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
          >
            {transcribeButton}
          </div>
        )}
      </div>
    );
  } else if (!isDesktopUp) {
    // Tablet: recents above, dropzone + record side by side (60/40)
    content = (
      <div className="flex w-full flex-col items-center gap-4 text-center">
        <RecoveryBanner />
        <RecentProjects />
        <div className="grid w-full grid-cols-[3fr_2fr] items-start gap-4">
          <FileUpload onUploadComplete={handleUploadComplete} />
          <RecordButton onUploadComplete={handleUploadComplete} size="large" />
        </div>
        {demoButton}
        {optionsAndInstrument}
        {transcribeButton}
        {errorBlock}
      </div>
    );
  } else {
    // Desktop: current layout, unchanged
    content = (
      <div className="flex w-full flex-col items-center gap-4 text-center">
        <RecoveryBanner />
        <RecentProjects />
        <FileUpload onUploadComplete={handleUploadComplete} />
        <div className="flex items-center gap-3 w-full max-w-md">
          <div className="flex-1 h-px bg-ink-soft/30" />
          <span className="text-xs text-ink-soft/60 uppercase">{t('or')}</span>
          <div className="flex-1 h-px bg-ink-soft/30" />
        </div>
        <RecordButton onUploadComplete={handleUploadComplete} />
        {demoButton}
        {optionsAndInstrument}
        {transcribeButton}
        {errorBlock}
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-paper"
      onDragEnter={handleWindowDragEnter}
      onDragOver={handleWindowDragOver}
      onDragLeave={handleWindowDragLeave}
      onDrop={handleWindowDrop}
    >
      <Tour />

      {/* Full-window drop overlay (U23) */}
      {isWindowDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/80 backdrop-blur-sm pointer-events-none">
          <div className="m-6 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent px-12 py-16 text-center">
            <span className="text-4xl">🎵</span>
            <p className="text-lg font-semibold text-ink">{t('dropAnywhereTitle')}</p>
            <p className="text-sm text-ink-soft">{t('dropAnywhereHint')}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-paper-dark shadow-sm border-b border-ink-soft/15">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-baseline gap-2">
            <h1 className="text-2xl font-bold text-ink">MelodyScribe</h1>
            <VersionBadge />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleOpenClick} className="btn-secondary" title={t('openTitle')}>
              {t('open')}
            </button>
            <input ref={openFileRef} type="file" accept=".melody" className="hidden" onChange={handleOpenFile} />
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Upload screen */}
      <main className="mx-auto w-full px-4 py-8 sm:max-w-xl lg:max-w-2xl">
        {content}
      </main>
    </div>
  );
}

export default App;
