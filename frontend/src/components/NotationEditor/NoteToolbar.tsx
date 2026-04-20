import React, { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { NoteData } from '../../types';
import { apiClient } from '../../services/apiClient';
import { SuggestionsPanel } from '../LLMPanel/SuggestionsPanel';

export const NoteToolbar: React.FC = () => {
  const selectedNoteId = useProjectStore((state) => state.selectedNoteId);
  const notes = useProjectStore((state) => state.notes);
  const metadata = useProjectStore((state) => state.metadata);
  const updateNote = useProjectStore((state) => state.updateNote);
  const deleteNote = useProjectStore((state) => state.deleteNote);
  const insertNote = useProjectStore((state) => state.insertNote);
  const corrections = useProjectStore((state) => state.corrections);
  const verificationConfidence = useProjectStore((state) => state.verificationConfidence);
  const setCorrections = useProjectStore((state) => state.setCorrections);
  const setVerificationConfidence = useProjectStore((state) => state.setVerificationConfidence);

  const [isVerifying, setIsVerifying] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Find selected note
  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId),
    [notes, selectedNoteId]
  );

  if (!selectedNote) {
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

  // Handle pitch up
  const handlePitchUp = () => {
    const { note, octave } = parsePitch(selectedNote.pitch);
    const currentIndex = pitchNotes.indexOf(note);
    
    if (currentIndex === -1) return;

    let newIndex = currentIndex + 1;
    let newOctave = octave;

    // Wrap around octave
    if (newIndex >= pitchNotes.length) {
      newIndex = 0;
      newOctave += 1;
    }

    const newPitch = createPitch(pitchNotes[newIndex], newOctave);
    updateNote(selectedNoteId!, { pitch: newPitch });
    console.log(`🎵 Pitch up: ${selectedNote.pitch} → ${newPitch}`);
  };

  // Handle pitch down
  const handlePitchDown = () => {
    const { note, octave } = parsePitch(selectedNote.pitch);
    const currentIndex = pitchNotes.indexOf(note);
    
    if (currentIndex === -1) return;

    let newIndex = currentIndex - 1;
    let newOctave = octave;

    // Wrap around octave
    if (newIndex < 0) {
      newIndex = pitchNotes.length - 1;
      newOctave -= 1;
    }

    const newPitch = createPitch(pitchNotes[newIndex], newOctave);
    updateNote(selectedNoteId!, { pitch: newPitch });
    console.log(`🎵 Pitch down: ${selectedNote.pitch} → ${newPitch}`);
  };

  // Handle duration change
  const handleDurationChange = (duration: string) => {
    updateNote(selectedNoteId!, { duration });
    console.log(`⏱️  Duration changed: ${selectedNote.duration} → ${duration}`);
  };

  // Handle delete note
  const handleDeleteNote = () => {
    deleteNote(selectedNoteId!);
    console.log(`🗑️  Note deleted: ${selectedNote.pitch}`);
  };

  // Handle add rest after note
  const handleAddRest = () => {
    const restNote: NoteData = {
      id: `rest-${Date.now()}`,
      pitch: 'rest',
      duration: selectedNote.duration,
      startBeat: selectedNote.startBeat + (durationToBeats(selectedNote.duration) || 0),
      measure: selectedNote.measure,
      velocity: 0,
      confidence: 1,
      llmCorrected: false,
    };

    insertNote(selectedNoteId!, restNote);
    console.log(`⏸️  Rest added after note`);
  };

  // Handle verify with AI
  const handleVerify = async () => {
    if (notes.length === 0 || !metadata) {
      console.warn('No notes or metadata available');
      return;
    }

    setIsVerifying(true);
    try {
      const result = await apiClient.verifyNotes(
        notes,
        metadata.instrument,
        metadata.tempo,
        metadata.key
      );

      console.log('Verification result:', result);

      if (result.success && result.data) {
        const corrections = result.data.corrections || [];
        const confidence = result.data.confidence || 0;

        setCorrections(corrections);
        setVerificationConfidence(confidence);
        setShowSuggestions(true);

        console.log(`🤖 Verification complete: ${corrections.length} corrections, confidence: ${(confidence * 100).toFixed(0)}%`);
      } else {
        console.error('Verification failed:', result.data?.error);
      }
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
    <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-blue-900">
          Note: {selectedNote.pitch} ({selectedNote.duration})
        </span>
      </div>

      {/* Pitch Controls */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700">Pitch:</span>
          <button
            onClick={handlePitchDown}
            className="px-3 py-1.5 bg-white border border-blue-300 rounded hover:bg-blue-50 active:bg-blue-100 transition font-semibold text-blue-600"
            title="Pitch down (semitone)"
          >
            ▼
          </button>
          <span className="text-sm font-semibold text-gray-700 w-12 text-center">
            {selectedNote.pitch}
          </span>
          <button
            onClick={handlePitchUp}
            className="px-3 py-1.5 bg-white border border-blue-300 rounded hover:bg-blue-50 active:bg-blue-100 transition font-semibold text-blue-600"
            title="Pitch up (semitone)"
          >
            ▲
          </button>
        </div>
      </div>

      {/* Duration Controls */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-medium text-gray-700">Duration:</span>
        <div className="flex gap-1.5">
          {durationButtons.map((duration) => (
            <button
              key={duration}
              onClick={() => handleDurationChange(duration)}
              className={`px-3 py-1.5 rounded font-semibold transition ${
                selectedNote.duration === duration
                  ? 'bg-blue-600 text-white border border-blue-700'
                  : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50 active:bg-blue-100'
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
          className="px-4 py-1.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded font-medium text-sm transition"
          title="Add rest after this note"
        >
          + Rest
        </button>
        <button
          onClick={handleDeleteNote}
          className="px-4 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded font-medium text-sm transition"
          title="Delete this note"
        >
          Delete
        </button>
        <button
          onClick={handleVerify}
          disabled={isVerifying || notes.length === 0}
          className={`ml-auto px-4 py-1.5 rounded font-medium text-sm transition flex items-center gap-2 ${
            isVerifying || notes.length === 0
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white'
          }`}
          title={notes.length === 0 ? 'No notes to verify' : 'Verify transcription with AI'}
        >
          {isVerifying ? (
            <>
              <span className="animate-spin">⟳</span>
              Verifying...
            </>
          ) : (
            <>🤖 Verify with AI</>
          )}
        </button>
      </div>

      {/* Info */}
      <div className="mt-3 text-xs text-blue-700 bg-white bg-opacity-50 rounded px-2 py-1">
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
    </div>
  );
};
