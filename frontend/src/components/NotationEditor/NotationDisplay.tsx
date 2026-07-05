import React from 'react';
import { NoteData } from '../../types';
import { useProjectStore } from '../../store/projectStore';
import { useNotationRenderer } from '../../hooks/useNotationRenderer';

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

  return (
    <div className="w-full notation-display">
      <h2 className="text-lg font-semibold mb-2">
        Notation Editor - {notes.length} notes
        {selectedNoteId && (
          <span className="ml-3 text-sm text-blue-600 font-normal">
            (Selected: {notes.find((n) => n.id === selectedNoteId)?.pitch})
          </span>
        )}
      </h2>
      <div className="mb-2 text-sm text-gray-600">
        Time: {timeSignature} | Key: {keySignature}
      </div>
      <div className="border border-gray-200 rounded-lg p-4 bg-white min-h-48">
        <div ref={containerRef} className="w-full" />
        {notes.length > 0 && (
          <div className="mt-4 text-xs text-gray-500">
            <p className="font-semibold mb-1">Notes loaded:</p>
            <ul>
              {notes.slice(0, 3).map((note) => (
                <li
                  key={note.id}
                  className={`cursor-pointer py-1 px-2 rounded ${
                    selectedNoteId === note.id
                      ? 'bg-blue-100 text-blue-900'
                      : 'hover:bg-gray-100'
                  }`}
                  onClick={() => setSelectedNote(note.id)}
                >
                  {note.pitch} ({note.duration}) - confidence: {(note.confidence * 100).toFixed(0)}%
                  {note.articulation && (
                    <span className="ml-1 text-purple-600 font-medium">· {note.articulation}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
        <span className="font-medium">Confidence:</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#16a34a' }} />
          High (&ge;90%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#d97706' }} />
          Medium (70–90%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#dc2626' }} />
          Low (&lt;70%)
        </span>
        <span className="ml-2 text-gray-400">· Click a note to select</span>
      </div>
    </div>
  );
};
