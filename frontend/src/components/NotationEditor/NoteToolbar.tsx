import React, { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { NoteData } from '../../types';
import { apiClient } from '../../services/apiClient';
import { SuggestionsPanel } from '../TheoryPanel/SuggestionsPanel';
import { BottomSheet } from '../ui/BottomSheet';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useT, durationLabel } from '../../i18n';
import { transposeSemitones, transposeOctaves, durationToBeats } from '../../utils/noteUtils';

const DURATION_BUTTONS = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'];
const DURATION_LABELS: Record<string, string> = {
  whole: '1',
  half: '1/2',
  quarter: '1/4',
  eighth: '1/8',
  sixteenth: '1/16',
};

/** Note-editing panel: sticky card on tablet/desktop, a non-modal BottomSheet
 * on phone (playback bar hides while it's open — see EditorScreen). Both
 * variants share the same handlers (SPEC.md §4). */
export const NoteToolbar: React.FC = () => {
  const t = useT();
  const isTabletUp = useMediaQuery('(min-width: 640px)');
  const selectedNoteId = useProjectStore((state) => state.selectedNoteId);
  const notes = useProjectStore((state) => state.notes);
  const metadata = useProjectStore((state) => state.metadata);
  const updateNote = useProjectStore((state) => state.updateNote);
  const deleteNote = useProjectStore((state) => state.deleteNote);
  const insertNote = useProjectStore((state) => state.insertNote);
  const setSelectedNote = useProjectStore((state) => state.setSelectedNote);
  const corrections = useProjectStore((state) => state.corrections);
  const verificationConfidence = useProjectStore((state) => state.verificationConfidence);
  const setCorrections = useProjectStore((state) => state.setCorrections);
  const setVerificationConfidence = useProjectStore((state) => state.setVerificationConfidence);

  const [isVerifying, setIsVerifying] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const selectedIndex = useMemo(
    () => notes.findIndex((n) => n.id === selectedNoteId),
    [notes, selectedNoteId]
  );
  const selectedNote = selectedIndex >= 0 ? notes[selectedIndex] : undefined;

  if (!selectedNote) return null;

  const goToOffset = (offset: number) => {
    const next = notes[selectedIndex + offset];
    if (next) setSelectedNote(next.id);
  };

  const handlePitchUp = () => updateNote(selectedNoteId!, { pitch: transposeSemitones(selectedNote.pitch, 1) });
  const handlePitchDown = () => updateNote(selectedNoteId!, { pitch: transposeSemitones(selectedNote.pitch, -1) });
  const handleOctaveUp = () => updateNote(selectedNoteId!, { pitch: transposeOctaves(selectedNote.pitch, 1) });
  const handleOctaveDown = () => updateNote(selectedNoteId!, { pitch: transposeOctaves(selectedNote.pitch, -1) });
  const handleDurationChange = (duration: string) => updateNote(selectedNoteId!, { duration });
  const handleDeleteNote = () => deleteNote(selectedNoteId!);
  const handleDone = () => setSelectedNote(null);

  const handleAddRest = () => {
    const restNote: NoteData = {
      id: `rest-${Date.now()}`,
      pitch: 'rest',
      duration: selectedNote.duration,
      startBeat: selectedNote.startBeat + durationToBeats(selectedNote.duration),
      measure: selectedNote.measure,
      velocity: 0,
      confidence: 1,
      theoryCorrected: false,
    };
    insertNote(selectedNoteId!, restNote);
  };

  const handleVerify = async () => {
    if (notes.length === 0 || !metadata) return;
    setIsVerifying(true);
    try {
      const result = await apiClient.verifyNotes(notes, metadata.instrument, metadata.tempo, metadata.key);
      setCorrections(result.corrections || []);
      setVerificationConfidence(result.confidence || 0);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Verification error:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  const prevNextSteppers = (
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={() => goToOffset(-1)}
        disabled={selectedIndex <= 0}
        title={t('prevNoteTitle')}
        className="btn-ghost"
        aria-label={t('prevNote')}
      >
        ◀
      </button>
      <span className="text-sm font-semibold text-ink">
        {selectedNote.pitch} · {durationLabel(selectedNote.duration, t)}
      </span>
      <button
        onClick={() => goToOffset(1)}
        disabled={selectedIndex >= notes.length - 1}
        title={t('nextNoteTitle')}
        className="btn-ghost"
        aria-label={t('nextNote')}
      >
        ▶
      </button>
    </div>
  );

  const pitchOctaveSteppers = (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs font-medium text-ink-soft">{t('pitch')}</span>
        <button onClick={handlePitchDown} title={t('pitchDownTitle')} aria-label={t('pitchDownTitle')} className="btn-secondary tap-target">
          −
        </button>
        <button onClick={handlePitchUp} title={t('pitchUpTitle')} aria-label={t('pitchUpTitle')} className="btn-secondary tap-target">
          +
        </button>
      </div>
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs font-medium text-ink-soft">{t('octave')}</span>
        <button onClick={handleOctaveDown} title={t('octaveDownTitle')} aria-label={t('octaveDownTitle')} className="btn-secondary tap-target">
          −
        </button>
        <button onClick={handleOctaveUp} title={t('octaveUpTitle')} aria-label={t('octaveUpTitle')} className="btn-secondary tap-target">
          +
        </button>
      </div>
    </div>
  );

  const durationSegmented = (
    <div className="flex items-center justify-center gap-1.5">
      {DURATION_BUTTONS.map((duration) => (
        <button
          key={duration}
          onClick={() => handleDurationChange(duration)}
          className={`tap-target rounded px-3 py-1.5 font-semibold transition ${
            selectedNote.duration === duration
              ? 'border border-accent bg-accent text-white'
              : 'border border-ink-soft/30 bg-surface text-accent hover:bg-paper-dark'
          }`}
          title={t('setDurationTitle', { d: durationLabel(duration, t) })}
        >
          {DURATION_LABELS[duration]}
        </button>
      ))}
    </div>
  );

  const suggestionsPanel = showSuggestions && corrections.length > 0 && (
    <SuggestionsPanel
      corrections={corrections}
      confidence={verificationConfidence}
      onClose={() => setShowSuggestions(false)}
    />
  );

  if (!isTabletUp) {
    return (
      <BottomSheet open onClose={handleDone} scrim={false}>
        <div className="space-y-4 px-4 pt-1">
          {prevNextSteppers}
          {pitchOctaveSteppers}
          <div>
            <p className="mb-1.5 text-center text-xs font-medium text-ink-soft">{t('duration')}</p>
            {durationSegmented}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleAddRest} title={t('addRestTitle')} className="btn-primary tap-target flex-1 justify-center bg-valid hover:opacity-90">
              + {t('addRest')}
            </button>
            <button
              onClick={handleDeleteNote}
              title={t('deleteNoteTitle')}
              className="tap-target flex-1 justify-center rounded-md border border-danger px-4 text-sm font-medium text-danger transition hover:bg-danger/10"
            >
              {t('deleteNote')}
            </button>
            <button onClick={handleDone} className="btn-primary tap-target flex-1 justify-center">
              {t('done')}
            </button>
          </div>
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            title={t('checkTheoryTitle')}
            className="btn-ghost w-full justify-center text-sm"
          >
            {isVerifying ? `⟳ ${t('checking')}` : t('checkTheory')}
          </button>
          {suggestionsPanel}
        </div>
      </BottomSheet>
    );
  }

  return (
    <div className="rounded-lg border border-ink-soft/15 bg-surface p-4 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        {prevNextSteppers}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink-soft">{t('pitch')}:</span>
          <button onClick={handlePitchDown} title={t('pitchDownTitle')} aria-label={t('pitchDownTitle')} className="btn-secondary">
            ▼
          </button>
          <span className="w-12 text-center text-sm font-semibold text-ink">{selectedNote.pitch}</span>
          <button onClick={handlePitchUp} title={t('pitchUpTitle')} aria-label={t('pitchUpTitle')} className="btn-secondary">
            ▲
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink-soft">{t('octave')}:</span>
          <button onClick={handleOctaveDown} title={t('octaveDownTitle')} aria-label={t('octaveDownTitle')} className="btn-secondary">
            ▼
          </button>
          <button onClick={handleOctaveUp} title={t('octaveUpTitle')} aria-label={t('octaveUpTitle')} className="btn-secondary">
            ▲
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs font-medium text-ink-soft">{t('duration')}:</span>
        {durationSegmented}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={handleAddRest} title={t('addRestTitle')} className="rounded bg-valid px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90">
          {t('addRest')}
        </button>
        <button onClick={handleDeleteNote} title={t('deleteNoteTitle')} className="rounded bg-danger px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90">
          {t('deleteNote')}
        </button>
        <button
          onClick={handleVerify}
          disabled={isVerifying || notes.length === 0}
          title={notes.length === 0 ? t('noNotesToCheck') : t('checkTheoryTitle')}
          className={`ml-auto flex items-center gap-2 rounded px-4 py-1.5 text-sm font-medium transition ${
            isVerifying || notes.length === 0
              ? 'cursor-not-allowed bg-ink-soft/20 text-ink-soft'
              : 'bg-accent text-white hover:bg-accent-hover'
          }`}
        >
          {isVerifying ? (
            <>
              <span className="animate-spin">⟳</span>
              {t('checking')}
            </>
          ) : (
            t('checkTheory')
          )}
        </button>
      </div>

      <div className="mt-3 rounded bg-paper px-2 py-1 text-xs text-ink-soft">
        <p>
          {t('confidence')}: {(selectedNote.confidence * 100).toFixed(0)}% |{' '}
          {t('velocity')}: {selectedNote.velocity} |{' '}
          {t('startBeat')}: {selectedNote.startBeat.toFixed(2)} ({t('beat')})
        </p>
      </div>

      {suggestionsPanel}
    </div>
  );
};
