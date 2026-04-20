import React, { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { apiClient } from '../../services/apiClient';

export const ExportButton: React.FC = () => {
  const notes = useProjectStore((state) => state.notes);
  const metadata = useProjectStore((state) => state.metadata);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!notes.length || !metadata) {
      setError('No notes or metadata available');
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      const project = {
        version: '1.0',
        metadata: {
          title: metadata.title,
          instrument: metadata.instrument,
          tempo: metadata.tempo,
          time_signature: metadata.timeSignature,
          key: metadata.key,
        },
        notes: notes.map((note) => ({
          id: note.id,
          pitch: note.pitch,
          duration: note.duration,
          start_beat: note.startBeat,
          measure: note.measure,
          velocity: note.velocity,
          confidence: note.confidence,
          llm_corrected: note.llmCorrected,
        })),
      };

      console.log('📄 Exporting PDF...');
      const pdfBlob = await apiClient.exportPdf(project);

      // Download PDF
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${metadata.title.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('✅ PDF exported successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      console.error('❌ Export error:', message);
      setError(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExport}
        disabled={isExporting || notes.length === 0}
        className={`px-6 py-2.5 rounded-lg font-semibold transition flex items-center gap-2 ${
          isExporting || notes.length === 0
            ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
        }`}
        title={notes.length === 0 ? 'No notes to export' : 'Export to PDF'}
      >
        {isExporting ? (
          <>
            <span className="animate-spin">⟳</span>
            Exporting...
          </>
        ) : (
          <>📄 Export PDF</>
        )}
      </button>

      {error && (
        <span className="text-sm text-red-600 font-medium">{error}</span>
      )}
    </div>
  );
};
