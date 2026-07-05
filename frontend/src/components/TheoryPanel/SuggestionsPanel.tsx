import React, { useMemo } from 'react';
import { Correction } from '../../types';
import { useProjectStore } from '../../store/projectStore';

interface SuggestionsPanelProps {
  corrections: Correction[];
  confidence: number;
  onClose: () => void;
}

export const SuggestionsPanel: React.FC<SuggestionsPanelProps> = ({
  corrections,
  confidence,
  onClose,
}) => {
  const notes = useProjectStore((state) => state.notes);
  const updateNote = useProjectStore((state) => state.updateNote);
  const clearCorrections = useProjectStore((state) => state.clearCorrections);

  // Track which corrections have been accepted/rejected
  const [processedIndices, setProcessedIndices] = React.useState<Set<number>>(
    new Set()
  );

  const pendingCorrections = useMemo(
    () => corrections.filter((_, idx) => !processedIndices.has(idx)),
    [corrections, processedIndices]
  );

  const applyCorrection = (correction: Correction) => {
    const note = notes[correction.noteIndex];
    if (!note) return;
    const updates =
      correction.field === 'pitch'
        ? { pitch: correction.newValue }
        : { duration: correction.newValue };
    updateNote(note.id, { ...updates, theoryCorrected: true });
  };

  const handleAccept = (index: number, correction: Correction) => {
    applyCorrection(correction);
    console.log(`✅ Accepted correction #${index}: ${correction.field} → ${correction.newValue}`);
    setProcessedIndices((prev) => new Set([...prev, index]));
  };

  const handleReject = (index: number) => {
    console.log(`❌ Rejected correction #${index}`);
    setProcessedIndices((prev) => new Set([...prev, index]));
  };

  const handleAcceptAll = () => {
    corrections.forEach((correction, idx) => {
      if (!processedIndices.has(idx)) {
        applyCorrection(correction);
      }
    });
    setProcessedIndices(new Set(corrections.map((_, idx) => idx)));
    console.log(`✅ Accepted all ${corrections.length} corrections`);
  };

  const handleClose = () => {
    clearCorrections();
    onClose();
  };

  if (corrections.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-300 rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-amber-900">
          🎼 Theory Verification Results
        </h3>
        <button
          onClick={handleClose}
          className="text-amber-600 hover:text-amber-800 text-xl font-bold"
          title="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Confidence Score */}
      <div className="mb-3 p-2 bg-white rounded border border-amber-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-amber-900">
            Verification Confidence:
          </span>
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  confidence > 0.75
                    ? 'bg-green-500'
                    : confidence > 0.5
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
            <span className="text-sm font-bold text-amber-900">
              {(confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Accept All Button */}
      {pendingCorrections.length > 0 && (
        <button
          onClick={handleAcceptAll}
          className="w-full mb-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded transition"
        >
          ✅ Accept All ({pendingCorrections.length})
        </button>
      )}

      {/* Corrections List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {corrections.map((correction, idx) => {
          const isProcessed = processedIndices.has(idx);
          const note = notes[correction.noteIndex];

          return (
            <div
              key={idx}
              className={`p-3 rounded border transition ${
                isProcessed
                  ? 'bg-gray-100 border-gray-300 opacity-60'
                  : 'bg-white border-amber-300 hover:border-amber-500'
              }`}
            >
              <div className="mb-2">
                <p className="text-sm font-semibold text-amber-900">
                  Note #{correction.noteIndex + 1}
                  {note && ` (${note.pitch})`}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Change <span className="font-bold">{correction.field}</span>:{' '}
                  <span className="line-through text-red-600">
                    {correction.oldValue}
                  </span>
                  {' → '}
                  <span className="text-green-600 font-bold">
                    {correction.newValue}
                  </span>
                </p>
                <p className="text-xs text-amber-700 mt-1 italic">
                  💡 {correction.reason}
                </p>
              </div>

              {/* Accept/Reject Buttons */}
              {!isProcessed && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(idx, correction)}
                    className="flex-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded transition"
                  >
                    ✅ Accept
                  </button>
                  <button
                    onClick={() => handleReject(idx)}
                    className="flex-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded transition"
                  >
                    ❌ Reject
                  </button>
                </div>
              )}

              {isProcessed && (
                <p className="text-xs text-gray-500 font-semibold">
                  {processedIndices.has(idx) ? '✓ Processed' : ''}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div className="mt-3 p-2 bg-white rounded border border-amber-200 text-xs text-gray-600">
        <p>
          Processed: {processedIndices.size} / {corrections.length}
        </p>
      </div>
    </div>
  );
};
