import { useState, useEffect } from 'react';
import { FileUpload } from './components/AudioControls/FileUpload';
import { InstrumentSelector } from './components/AudioControls/InstrumentSelector';
import { TranscribeOptions } from './components/AudioControls/TranscribeOptions';
import { Toolbar } from './components/Toolbar/Toolbar';
import { NotationDisplay } from './components/NotationEditor/NotationDisplay';
import { NoteToolbar } from './components/NotationEditor/NoteToolbar';
import { PlaybackControls } from './components/Playback/PlaybackControls';
import { ExportButton } from './components/ExportButton';
import { WaveformDisplay } from './components/WaveformDisplay';
import { useProjectStore } from './store/projectStore';
import { useRecentProjectsStore } from './store/recentProjectsStore';
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

  const {
    notes,
    metadata,
    audioFileId,
    error,
    setNotes,
    setMetadata,
    setAudioFileId,
    setLoading,
    setError,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useProjectStore();

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Shift+Z = redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

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
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsTranscribing(false);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">MelodyScribe</h1>
            <Toolbar />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!notes.length ? (
          <div className="text-center">
            {recents.length > 0 && (
              <div className="mb-6 text-left max-w-md mx-auto">
                <p className="text-sm font-semibold text-gray-700 mb-2">Recent projects</p>
                <ul className="space-y-1">
                  {recents.map((r) => (
                    <li key={r.name + r.savedAt} className="flex justify-between text-sm text-gray-600 border-b border-gray-100 pb-1">
                      <span className="truncate">{r.name}</span>
                      <span className="ml-3 text-gray-400 shrink-0">{relativeTime(r.savedAt)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-400 mt-1">Use "Open Project" to reopen a saved file.</p>
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
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTranscribing ? 'Transcribing...' : 'Transcribe Audio'}
                </button>
              )}
            </div>
            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <button
                onClick={undo}
                disabled={!canUndo()}
                title="Undo (Ctrl+Z)"
                className="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ↩ Undo
              </button>
              <button
                onClick={redo}
                disabled={!canRedo()}
                title="Redo (Ctrl+Shift+Z)"
                className="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ↪ Redo
              </button>
            </div>
            <NotationDisplay
              notes={notes}
              timeSignature={metadata?.timeSignature || '4/4'}
              keySignature={metadata?.key || 'C'}
            />
            <WaveformDisplay notes={notes} tempo={metadata?.tempo || 120} />
            <NoteToolbar />
            <PlaybackControls bpm={metadata?.tempo || 120} />
            <div className="flex justify-center gap-4">
              <ExportButton />
              <button
                onClick={() => {
                  setNotes([]);
                  setMetadata(null);
                  setAudioFileId(null);
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Start New Transcription
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer with metadata */}
      {metadata && (
        <footer className="bg-white border-t mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-center space-x-6 text-sm text-gray-600">
              <span>Instrument: {metadata.instrument}</span>
              <span>Tempo: {metadata.tempo} BPM</span>
              <span>Key: {metadata.key}</span>
              <span>Time: {metadata.timeSignature}</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;