import React, { useRef, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { apiClient } from '../services/apiClient';
import jsPDF from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { useT, localizeError } from '../i18n';

export const ExportButton: React.FC = () => {
  const t = useT();
  const notes = useProjectStore((state) => state.notes);
  const metadata = useProjectStore((state) => state.metadata);
  const setNotes = useProjectStore((state) => state.setNotes);
  const setMetadata = useProjectStore((state) => state.setMetadata);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!notes.length || !metadata) return;
    setIsExporting(true);
    setError(null);
    try {
      const svgEl = document.querySelector('.notation-display svg') as SVGSVGElement | null;
      if (!svgEl) {
        setError(t('svgNotFound'));
        return;
      }
      const svgWidth = svgEl.viewBox?.baseVal?.width || svgEl.clientWidth || 800;
      const svgHeight = svgEl.viewBox?.baseVal?.height || svgEl.clientHeight || 300;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const scale = pageWidth / svgWidth;
      doc.setFontSize(12);
      await svg2pdf(svgEl, doc, { x: 0, y: 0, width: svgWidth * scale, height: svgHeight * scale });
      doc.save(`${metadata.title.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      setError(localizeError(err, t) || t('pdfExportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMusicXML = async () => {
    if (!notes.length || !metadata) return;
    setIsExporting(true);
    setError(null);
    try {
      const blob = await apiClient.exportMusicXml(buildProject());
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${metadata.title.replace(/\s+/g, '_')}.musicxml`;
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

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={handleExportPDF}
        disabled={isExporting || !notes.length}
        className="btn-primary"
        title={t('exportPdfTitle')}
      >
        {isExporting ? `⟳ ${t('exporting')}` : t('exportPdf')}
      </button>

      <button
        onClick={handleExportMusicXML}
        disabled={isExporting || !notes.length}
        className="btn-secondary"
        title={t('exportMusicXmlTitle')}
      >
        {isExporting ? `⟳ ${t('exporting')}` : 'MusicXML'}
      </button>

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
        className="btn-secondary"
        title={t('importTitle')}
      >
        {isImporting ? `⟳ ${t('importing')}` : t('importLabel')}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".musicxml,.xml,.mxl"
        className="hidden"
        onChange={handleImportMusicXML}
      />

      {error && (
        <span className="text-sm text-danger font-medium">{error}</span>
      )}
    </div>
  );
};
