import React, { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { NoteData } from '../../types';
import { apiClient } from '../../services/apiClient';
import { SuggestionsPanel } from '../TheoryPanel/SuggestionsPanel';

export const NoteToolbar: React.FC = () => {
  const selectedNoteId = useProjectStore((state) => state.selectedNoteId);
  const notes = useProjectStore((state) => state.notes);
  const metadata = useProjectStore((state) => state.metadata);
  const updateNote = useProjectStore((state) => state.updateNote);
  const deleteNote = useProjectStore((state) => state.deleteNote);
  const insertNote = useProjectStore((state) => state.insertNote);
  const shiftAllOctaves = useProjectStore((state) => state.shiftAllOctaves);
  const corrections = useProjectStore((state) => state.corrections);
  const verificationConfidence = useProjectStore((state) => state.verificationConfidence);
  const setCorrections = useProjectStore((state) => state.setCorrections);
  const setVerificationConfidence = useProjectStore((state) => state.setVerificationConfidence);

  const [isVerifying, setIsVerifying] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId),
    [notes, selectedNoteId]
  );

  if (!selectedNote && notes.length === 0) {
    return null;
  }

  // Pitch notes array
  const pitchNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // Parse pitch (e.g., "G3" -> { note: "G", octave: 3 })
  const parsePitch = (pitch: string) => {
    const note = pitch.slice(0, -1);
    const octave = parseInt(pitch.slice(-1), 10);
    return { note, octave };
  };

  // Create pitch (e.g., { note: "G", octave: 3 } -> "G3")
  const createPitch = (note: string, octave: number) => {
    // Ensure octave is valid (0-8)
    const validOctave = Math.max(0, Math.min(8, octave));
    return `${note}${validOctave}`;
  };

  const handlePitchUp = () => {
    if (!selectedNote || !selectedNoteId) return;
    const { note, octave } = parsePitch(selectedNote.pitch);
    const currentIndex = pitchNotes.indexOf(note);
    if (currentIndex === -1) return;
    let newIndex = currentIndex + 1;
    let newOctave = octave;
    if (newIndex >= pitchNotes.length) { newIndex = 0; newOctave += 1; }
    const newPitch = createPitch(pitchNotes[newIndex], newOctave);
    updateNote(selectedNoteId, { pitch: newPitch });
  };

  const handlePitchDown = () => {
    if (!selectedNote || !selectedNoteId) return;
    const { note, octave } = parsePitch(selectedNote.pitch);
    const currentIndex = pitchNotes.indexOf(note);
    if (currentIndex === -1) return;
    let newIndex = currentIndex - 1;
    let newOctave = octave;
    if (newIndex < 0) { newIndex = pitchNotes.length - 1; newOctave -= 1; }
    const newPitch = createPitch(pitchNotes[newIndex], newOctave);
    updateNote(selectedNoteId, { pitch: newPitch });
  };

  const handleDurationChange = (duration: string) => {
    if (!selectedNoteId) return;
    updateNote(selectedNoteId, { duration });
  };

  const handleDeleteNote = () => {
    if (!selectedNoteId) return;
    deleteNote(selectedNoteId);
  };

  const handleAddRest = () => {
    if (!selectedNote || !selectedNoteId) return;
    const restNote: NoteData = {
      id: `rest-${Date.now()}`,
      pitch: 'rest',
      duration: selectedNote.duration,
      startBeat: selectedNote.startBeat + (durationToBeats(selectedNote.duration) || 0),
      measure: selectedNote.measure,
      velocity: 0,
      confidence: 1,
      theoryCorrected: false,
    };
    insertNote(selectedNoteId, restNote);
  };

  // Handle verify with AI
  const handleVerify = async () => {
    if (notes.length === 0 || !metadata) {
      console.warn('No notes or metadata available');
      return;
    }

    setIsVerifying(true);
    try {
      // request() unwraps the {success, data, error} envelope and throws ApiError on failure
      const result = await apiClient.verifyNotes(
        notes,
        metadata.instrument,
        metadata.tempo,
        metadata.key
      );

      console.log('Verification result:', result);

      const corrections = result.corrections || [];
      const confidence = result.confidence || 0;

      setCorrections(corrections);
      setVerificationConfidence(confidence);
      setShowSuggestions(true);

      console.log(`🎼 Verification complete: ${corrections.length} corrections, confidence: ${(confidence * 100).toFixed(0)}%`);
    } catch (error) {
      console.error('Verification error:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  // Helper to convert duration to beats
  const durationToBeats = (duration: string): number => {
    const beatMap: { [key: string]: number } = {
      whole: 4,
      half: 2,
      quarter: 1,
      eighth: 0.5,
      sixteenth: 0.25,
    };
    return beatMap[duration] || 1;
  };

  const durationButtons = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'];
  const durationLabels: { [key: string]: string } = {
    whole: 'W',
    half: 'H',
    quarter: 'Q',
    eighth: '8',
    sixteenth: '16',
  };

  return (
    <div className="rounded-lg border border-ink-soft/15 bg-white p-4 shadow-md">
      {/* Octave section — always visible */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-ink-soft">Octave:</span>
        <button
          onClick={() => shiftAllOctaves(1)}
          className="px-3 py-1.5 bg-white border border-ink-soft/30 rounded hover:bg-paper-dark transition font-semibold text-accent text-sm"
          title="Shift all notes up one octave"
        >
          ↑ All up
        </button>
        <button
          onClick={() => shiftAllOctaves(-1)}
          className="px-3 py-1.5 bg-white border border-ink-soft/30 rounded hover:bg-paper-dark transition font-semibold text-accent text-sm"
          title="Shift all notes down one octave"
        >
          ↓ All down
        </button>
      </div>

      {selectedNote && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-ink">
              Note: {selectedNote.pitch} ({selectedNote.duration})
            </span>
          </div>

          {/* Pitch Controls */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink-soft">Pitch:</span>
              <button
                onClick={handlePitchDown}
                className="px-3 py-1.5 bg-white border border-ink-soft/30 rounded hover:bg-paper-dark transition font-semibold text-accent"
                title="Pitch down (semitone)"
              >
                ▼
              </button>
              <span className="text-sm font-semibold text-ink w-12 text-center">
                {selectedNote.pitch}
              </span>
              <button
                onClick={handlePitchUp}
                className="px-3 py-1.5 bg-white border border-ink-soft/30 rounded hover:bg-paper-dark transition font-semibold text-accent"
                title="Pitch up (semitone)"
              >
                ▲
              </button>
            </div>
          </div>

          {/* Duration Controls */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-medium text-ink-soft">Duration:</span>
            <div className="flex gap-1.5">
              {durationButtons.map((duration) => (
                <button
                  key={duration}
                  onClick={() => handleDurationChange(duration)}
                  className={`px-3 py-1.5 rounded font-semibold transition ${
                    selectedNote.duration === duration
                      ? 'bg-accent text-white border border-accent'
                      : 'bg-white text-accent border border-ink-soft/30 hover:bg-paper-dark'
                  }`}
                  title={`Set duration to ${duration}`}
                >
                  {durationLabels[duration]}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddRest}
              className="px-4 py-1.5 bg-valid hover:opacity-90 text-white rounded font-medium text-sm transition"
              title="Add rest after this note"
            >
              + Rest
            </button>
            <button
              onClick={handleDeleteNote}
              className="px-4 py-1.5 bg-danger hover:opacity-90 text-white rounded font-medium text-sm transition"
              title="Delete this note"
            >
              Delete
            </button>
            <button
              onClick={handleVerify}
              disabled={isVerifying || notes.length === 0}
              className={`ml-auto px-4 py-1.5 rounded font-medium text-sm transition flex items-center gap-2 ${
                isVerifying || notes.length === 0
                  ? 'bg-ink-soft/20 text-ink-soft cursor-not-allowed'
                  : 'bg-accent hover:bg-accent-hover text-white'
              }`}
              title={notes.length === 0 ? 'No notes to verify' : 'Verify transcription with AI'}
            >
              {isVerifying ? (
                <>
                  <span className="animate-spin">⟳</span>
                  Verifying...
                </>
              ) : (
                'Verify with AI'
              )}
            </button>
          </div>

          {/* Info */}
          <div className="mt-3 text-xs text-ink-soft bg-paper rounded px-2 py-1">
            <p>
              Confidence: {(selectedNote.confidence * 100).toFixed(0)}% |
              Velocity: {selectedNote.velocity} |
              Start: {selectedNote.startBeat.toFixed(2)} beat
            </p>
          </div>

          {/* Suggestions Panel */}
          {showSuggestions && corrections.length > 0 && (
            <SuggestionsPanel
              corrections={corrections}
              confidence={verificationConfidence}
              onClose={() => setShowSuggestions(false)}
            />
          )}
        </>
      )}
    </div>
  );
};
