import { useRef, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useUiStore } from '../store/uiStore';
import { apiClient } from '../services/apiClient';
import { exportScorePdf } from '../services/pdfExport';
import { useT, localizeError } from '../i18n';

/** PDF/MusicXML export + MusicXML import, shared by the editor header's
 * Export menu (and, previously, the standalone ExportButton). */
export function useExportActions() {
  const t = useT();
  const language = useUiStore((s) => s.language);
  const notes = useProjectStore((state) => state.notes);
  const metadata = useProjectStore((state) => state.metadata);
  const setNotes = useProjectStore((state) => state.setNotes);
  const setMetadata = useProjectStore((state) => state.setMetadata);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canExport = Boolean(notes.length && metadata);

  const buildProject = () => ({
    version: '1.0' as const,
    metadata: {
      title: metadata!.title,
      instrument: metadata!.instrument,
      tempo: metadata!.tempo,
      timeSignature: metadata!.timeSignature,
      key: metadata!.key,
    },
    notes: notes.map((note) => ({
      id: note.id,
      pitch: note.pitch,
      duration: note.duration,
      startBeat: note.startBeat,
      measure: note.measure,
      velocity: note.velocity,
      confidence: note.confidence,
      theoryCorrected: note.theoryCorrected,
    })),
  });

  const handleExportPDF = async () => {
    if (!canExport) return;
    setIsExporting(true);
    setError(null);
    try {
      const svgEl = document.querySelector('.notation-display svg') as SVGSVGElement | null;
      if (!svgEl) {
        setError(t('svgNotFound'));
        return;
      }
      const doc = await exportScorePdf(svgEl, metadata!, t, language);
      doc.save(`${metadata!.title.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      setError(localizeError(err, t) || t('pdfExportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMusicXML = async () => {
    if (!canExport) return;
    setIsExporting(true);
    setError(null);
    try {
      const blob = await apiClient.exportMusicXml(buildProject());
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${metadata!.title.replace(/\s+/g, '_')}.musicxml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(localizeError(err, t) || t('exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportMusicXML = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setError(null);
    try {
      const result = await apiClient.importMusicXml(file);
      setNotes(result.notes);
      setMetadata({
        title: result.title,
        instrument: result.instrument,
        tempo: result.tempo,
        timeSignature: result.timeSignature,
        key: result.key,
      });
    } catch (err) {
      setError(localizeError(err, t) || t('importFailed'));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return {
    canExport,
    isExporting,
    isImporting,
    error,
    fileInputRef,
    handleExportPDF,
    handleExportMusicXML,
    handleImportMusicXML,
  };
}
