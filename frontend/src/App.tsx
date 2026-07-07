import { useState, useEffect } from 'react';
import { FileUpload } from './components/AudioControls/FileUpload';
import { InstrumentSelector } from './components/AudioControls/InstrumentSelector';
import { TranscribeOptions } from './components/AudioControls/TranscribeOptions';
import { Toolbar } from './components/Toolbar/Toolbar';
import { EditorScreen } from './components/EditorScreen';
import { useProjectStore } from './store/projectStore';
import { useToast } from './components/Toast';
import { Tour } from './components/Tour';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ThemeToggle } from './components/ThemeToggle';
import { RecoveryBanner } from './components/RecoveryBanner';
import { RecentProjects } from './components/RecentProjects';
import { apiClient } from './services/apiClient';
import { startAutosave } from './services/autosave';
import { useApplyTheme } from './hooks/useTheme';
import { useT, localizeError, instrumentLabel } from './i18n';
import { AudioInfo, Instrument, TranscriptionData } from './types';

function App() {
  const [instrument, setInstrument] = useState<Instrument>('violin');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [optBpm, setOptBpm] = useState('');
  const [optTimeSignature, setOptTimeSignature] = useState('4/4');
  const [optKey, setOptKey] = useState('');
  const { showToast } = useToast();
  const t = useT();

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

  const handleTranscribe = async () => {
    if (!audioFileId) return;

    setIsTranscribing(true);
    setLoading(true);
    setError(null);

    try {
      const options: { bpm?: number; timeSignature?: string; key?: string } = {};
      if (optBpm) options.bpm = Number(optBpm);
      if (optTimeSignature) options.timeSignature = optTimeSignature;
      if (optKey) options.key = optKey;
      const result: TranscriptionData = await apiClient.transcribe(audioFileId, instrument, options);
      setNotes(result.notes);
      setMetadata({
        title: `${t('transcription')} — ${instrumentLabel(instrument, t)}`,
        instrument,
        tempo: result.tempo,
        timeSignature: result.timeSignature,
        key: result.key,
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

  // Post-transcription editor takes over the whole window (own top/bottom bars)
  if (notes.length > 0) {
    return (
      <>
        <Tour />
        <EditorScreen />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <Tour />
      {/* Header */}
      <header className="bg-paper-dark shadow-sm border-b border-ink-soft/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-ink">MelodyScribe</h1>
            <div className="flex items-center gap-3">
              <Toolbar />
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </header>

      {/* Upload screen */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <RecoveryBanner />
          <RecentProjects />
          <FileUpload onUploadComplete={handleUploadComplete} />
          <div className="mt-6 flex flex-col items-center gap-4">
            <InstrumentSelector value={instrument} onChange={setInstrument} />
            <TranscribeOptions
              bpm={optBpm}
              setBpm={setOptBpm}
              timeSignature={optTimeSignature}
              setTimeSignature={setOptTimeSignature}
              musicalKey={optKey}
              setMusicalKey={setOptKey}
            />
            {audioFileId && (
              <button
                onClick={handleTranscribe}
                disabled={isTranscribing}
                className="btn-primary px-6 py-3 text-base"
              >
                {isTranscribing ? t('transcribing') : t('transcribe')}
              </button>
            )}
          </div>
          {error && (
            <div className="mt-6 p-4 bg-danger/10 border border-danger/30 rounded-md">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
