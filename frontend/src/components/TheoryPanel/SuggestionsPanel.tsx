import React, { useMemo } from 'react';
import { Correction } from '../../types';
import { useProjectStore } from '../../store/projectStore';
import { useT } from '../../i18n';

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
  const t = useT();

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
    <div className="bg-warn/10 border border-warn/30 rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-ink">
          🎼 {t('theoryResults')}
        </h3>
        <button
          onClick={handleClose}
          className="text-ink-soft hover:text-ink text-xl font-bold"
          aria-label={t('closePanel')}
        >
          ✕
        </button>
      </div>

      {/* Confidence Score */}
      <div className="mb-3 p-2 bg-surface rounded border border-warn/30">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">
            {t('theoryConfidence')}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-paper-dark rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  confidence > 0.75
                    ? 'bg-valid'
                    : confidence > 0.5
                    ? 'bg-warn'
                    : 'bg-danger'
                }`}
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
            <span className="text-sm font-bold text-ink">
              {(confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Accept All Button */}
      {pendingCorrections.length > 0 && (
        <button
          onClick={handleAcceptAll}
          className="w-full mb-3 px-4 py-2 bg-valid hover:opacity-90 text-white font-semibold rounded transition"
        >
          ✅ {t('acceptAll', { n: pendingCorrections.length })}
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
                  ? 'bg-paper-dark border-ink-soft/30 opacity-60'
                  : 'bg-surface border-warn/40 hover:border-warn'
              }`}
            >
              <div className="mb-2">
                <p className="text-sm font-semibold text-ink">
                  {t('noteNumber', { n: correction.noteIndex + 1 })}
                  {note && ` (${note.pitch})`}
                </p>
                <p className="text-xs text-ink-soft mt-1">
                  {t('changeField')}{' '}
                  <span className="font-bold">
                    {correction.field === 'pitch' ? t('fieldPitch') : t('fieldDuration')}
                  </span>:{' '}
                  <span className="line-through text-danger">
                    {correction.oldValue}
                  </span>
                  {' → '}
                  <span className="text-valid font-bold">
                    {correction.newValue}
                  </span>
                </p>
                <p className="text-xs text-warn mt-1 italic">
                  💡 {correction.reason}
                </p>
              </div>

              {/* Accept/Reject Buttons */}
              {!isProcessed && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(idx, correction)}
                    className="flex-1 px-3 py-1.5 bg-valid hover:opacity-90 text-white text-sm font-semibold rounded transition"
                  >
                    ✅ {t('accept')}
                  </button>
                  <button
                    onClick={() => handleReject(idx)}
                    className="flex-1 px-3 py-1.5 bg-danger hover:opacity-90 text-white text-sm font-semibold rounded transition"
                  >
                    ❌ {t('reject')}
                  </button>
                </div>
              )}

              {isProcessed && (
                <p className="text-xs text-ink-soft font-semibold">
                  {processedIndices.has(idx) ? `✓ ${t('processed')}` : ''}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div className="mt-3 p-2 bg-surface rounded border border-warn/30 text-xs text-ink-soft">
        <p>
          {t('processedCount', { done: processedIndices.size, total: corrections.length })}
        </p>
      </div>
    </div>
  );
};
