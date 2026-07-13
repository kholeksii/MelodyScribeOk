import React, { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { MeterChip } from './MeterChip';
import { useT, instrumentLabel } from '../i18n';

/** Single tappable chip that collapses all metadata (meter/key/tempo/
 * instrument) into one summary for tablet/phone headers (SPEC.md §4).
 * Tapping opens a small popover with the details and the interactive
 * MeterChip for re-barring. */
export const MetadataChip: React.FC = () => {
  const t = useT();
  const metadata = useProjectStore((s) => s.metadata);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!metadata) return null;

  const meterLabel = metadata.timeSignatureAuto
    ? `${metadata.timeSignature} (${t('auto')})`
    : metadata.timeSignature;
  const summary = `${meterLabel} · ${metadata.key} · ${metadata.tempo} BPM · ${instrumentLabel(metadata.instrument, t)}`;

  return (
    <div ref={rootRef} className="relative inline-flex min-w-0">
      <button
        onClick={() => setOpen((v) => !v)}
        title={t('metadataSummaryTitle')}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="tap-target max-w-[180px] truncate whitespace-nowrap rounded-full border border-ink-soft/20 bg-surface/60 px-2.5 py-0.5 text-xs text-ink-soft"
      >
        {summary}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t('metadataSummaryTitle')}
          className="absolute left-0 top-full z-40 mt-1 w-64 space-y-2 rounded-lg border border-ink-soft/15 bg-surface p-3 text-sm text-ink shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-ink-soft">{t('instrument')}</span>
            <span>{instrumentLabel(metadata.instrument, t)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-soft">♩</span>
            <span>{metadata.tempo} BPM</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-soft">{t('key')}</span>
            <span>{metadata.key}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-soft">{t('time')}</span>
            <MeterChip />
          </div>
        </div>
      )}
    </div>
  );
};
