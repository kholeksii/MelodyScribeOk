import React, { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { apiClient } from '../services/apiClient';
import type { Instrument } from '../types';
import { useToast } from './Toast';
import { useT, localizeError } from '../i18n';

const METERS = ['2/4', '3/4', '4/4', '6/8'];

/** Editor metadata chip for the time signature (U35).
 *
 * Shows «2/4 (авто)» when the meter came from U31 auto-detection. Clicking
 * opens a small popover with the common meters — one click re-quantizes via
 * the normal transcribe flow (keeping the current tempo and key fixed), and
 * an explicit choice drops the «(авто)» suffix. Needs the audio to still be
 * on the backend; otherwise the chip is a plain label. */
export const MeterChip: React.FC = () => {
  const t = useT();
  const { showToast } = useToast();
  const metadata = useProjectStore((s) => s.metadata);
  const audioFileId = useProjectStore((s) => s.audioFileId);
  const setNotes = useProjectStore((s) => s.setNotes);
  const setMetadata = useProjectStore((s) => s.setMetadata);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  const label = metadata.timeSignatureAuto
    ? `${metadata.timeSignature} (${t('auto')})`
    : metadata.timeSignature;
  const interactive = Boolean(audioFileId);

  const chipClass =
    'whitespace-nowrap rounded-full border border-ink-soft/20 bg-surface/60 px-2.5 py-0.5 text-xs text-ink-soft';

  if (!interactive) {
    return (
      <span className={chipClass} title={t('meterNeedsAudio')}>
        {label}
      </span>
    );
  }

  const switchMeter = async (meter: string) => {
    setOpen(false);
    if (busy || !audioFileId) return;
    setBusy(true);
    try {
      // Re-quantize with the meter pinned; tempo and key stay as detected
      const result = await apiClient.transcribe(audioFileId, metadata.instrument as Instrument, {
        timeSignature: meter,
        bpm: metadata.tempo,
        key: metadata.key,
      });
      setNotes(result.notes);
      setMetadata({
        ...metadata,
        timeSignature: result.timeSignature,
        tempo: result.tempo,
        timeSignatureAuto: false,
      });
    } catch (err) {
      showToast(localizeError(err, t) || t('meterSwitchFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className={`${chipClass} cursor-pointer transition hover:border-accent hover:text-ink disabled:cursor-wait`}
        title={t('meterChipTitle')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {busy ? `⟳ ${label}` : `${label} ▾`}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-40 mt-1 min-w-[9rem] rounded-lg border border-ink-soft/15 bg-surface p-1 shadow-lg"
        >
          <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-ink-soft/70">
            {t('meterChipHeading')}
          </div>
          {METERS.map((m) => (
            <button
              key={m}
              role="menuitem"
              onClick={() => switchMeter(m)}
              className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition hover:bg-paper-dark ${
                m === metadata.timeSignature ? 'font-semibold text-accent' : 'text-ink'
              }`}
            >
              {m}
              {m === metadata.timeSignature && metadata.timeSignatureAuto
                ? ` (${t('auto')})`
                : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
