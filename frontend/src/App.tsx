import { useState } from 'react';
import { FileUpload } from './components/AudioControls/FileUpload';
import { InstrumentSelector } from './components/AudioControls/InstrumentSelector';
import { TranscribeOptions } from './components/AudioControls/TranscribeOptions';
import { Toolbar } from './components/Toolbar/Toolbar';
import { EditorScreen } from './components/EditorScreen';
import { useProjectStore } from './store/projectStore';
import { useRecentProjectsStore } from './store/recentProjectsStore';
import { useToast } from './components/Toast';
import { Tour } from './components/Tour';
import { apiClient } from './services/apiClient';
import { AudioInfo, Instrument, TranscriptionData } from './types';

function relativeTime(ts: number): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diffMs = ts - Date.now();
  const diffDays = Math.round(diffMs / 86400000);
  if (Math.abs(diffDays) < 1) return 'today';
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, 'day');
  return rtf.format(Math.round(diffDays / 7), 'week');
}

function App() {
  const [instrument, setInstrument] = useState<Instrument>('violin');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [optBpm, setOptBpm] = useState('');
  const [optTimeSignature, setOptTimeSignature] = useState('4/4');
  const [optKey, setOptKey] = useState('');
  const recents = useRecentProjectsStore((s) => s.recents);
  const { showToast } = useToast();

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
        title: `Transcription - ${instrument}`,
        instrument,
        tempo: result.tempo,
        timeSignature: result.timeSignature,
        key: result.key,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transcription failed';
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
            <Toolbar />
          </div>
        </div>
      </header>

      {/* Upload screen */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          {recents.length > 0 && (
            <div className="mb-6 text-left max-w-md mx-auto">
              <p className="text-sm font-semibold text-ink mb-2">Recent projects</p>
              <ul className="space-y-1">
                {recents.map((r) => (
                  <li key={r.name + r.savedAt} className="flex justify-between text-sm text-ink-soft border-b border-ink-soft/10 pb-1">
                    <span className="truncate">{r.name}</span>
                    <span className="ml-3 text-ink-soft/60 shrink-0">{relativeTime(r.savedAt)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-soft/60 mt-1">Use "Open Project" to reopen a saved file.</p>
            </div>
          )}
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
                {isTranscribing ? 'Transcribing...' : 'Transcribe Audio'}
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
