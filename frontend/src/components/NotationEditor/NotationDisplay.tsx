import React from 'react';
import { NoteData } from '../../types';
import { useProjectStore } from '../../store/projectStore';
import { useNotationRenderer } from '../../hooks/useNotationRenderer';
import { useT, durationLabel } from '../../i18n';

interface NotationEditorProps {
  notes: NoteData[];
  timeSignature: string;
  keySignature: string;
}

export const NotationDisplay: React.FC<NotationEditorProps> = ({
  notes,
  timeSignature,
  keySignature,
}) => {
  const selectedNoteId = useProjectStore((state) => state.selectedNoteId);
  const setSelectedNote = useProjectStore((state) => state.setSelectedNote);
  const { containerRef } = useNotationRenderer({ notes, timeSignature, keySignature });
  const t = useT();

  return (
    <div className="w-full notation-display">
      <h2 className="text-lg font-semibold mb-2 text-ink">
        {t('notationEditor')} — {t('notesCount', { n: notes.length })}
        {selectedNoteId && (
          <span className="ml-3 text-sm text-accent font-normal">
            ({t('selected')}: {notes.find((n) => n.id === selectedNoteId)?.pitch})
          </span>
        )}
      </h2>
      <div className="mb-2 text-sm text-ink-soft">
        {t('time')}: {timeSignature} | {t('key')}: {keySignature}
      </div>
      <div className="border border-ink-soft/15 rounded-lg p-4 bg-white min-h-48 overflow-x-auto">
        <div ref={containerRef} className="w-full" />
        {notes.length > 0 && (
          <div className="mt-4 text-xs text-ink-soft">
            <p className="font-semibold mb-1">{t('notesLoaded')}</p>
            <ul>
              {notes.slice(0, 3).map((note) => (
                <li
                  key={note.id}
                  className={`cursor-pointer py-1 px-2 rounded ${
                    selectedNoteId === note.id
                      ? 'bg-accent/10 text-ink'
                      : 'hover:bg-paper-dark'
                  }`}
                  onClick={() => setSelectedNote(note.id)}
                >
                  {note.pitch} ({durationLabel(note.duration, t)}) — {t('confidenceValue', { p: (note.confidence * 100).toFixed(0) })}
                  {note.articulation && (
                    <span className="ml-1 text-accent font-medium">· {note.articulation}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-ink-soft">
        <span className="font-medium">{t('confidence')}:</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#16a34a' }} />
          {t('confHigh')}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#d97706' }} />
          {t('confMedium')}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#dc2626' }} />
          {t('confLow')}
        </span>
        <span className="ml-2 text-ink-soft/60">· {t('clickToSelect')}</span>
      </div>
    </div>
  );
};
