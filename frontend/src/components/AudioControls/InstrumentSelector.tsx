import React from 'react';
import { Instrument } from '../../types';
import { useT, instrumentLabel } from '../../i18n';

interface InstrumentSelectorProps {
  value: Instrument;
  onChange: (value: Instrument) => void;
}

const INSTRUMENTS: Instrument[] = ['violin', 'piano', 'guitar'];

const INSTRUMENT_ICON: Record<Instrument, string> = {
  violin: '🎻',
  piano: '🎹',
  guitar: '🎸',
};

/** Segmented control on the app's palette tokens (was off-palette gray/blue). */
export const InstrumentSelector: React.FC<InstrumentSelectorProps> = ({ value, onChange }) => {
  const t = useT();

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-sm font-medium text-ink-soft">{t('instrument')}</span>
      <div role="radiogroup" aria-label={t('instrument')} className="flex overflow-hidden rounded-md border border-ink-soft/30">
        {INSTRUMENTS.map((inst) => (
          <button
            key={inst}
            type="button"
            role="radio"
            aria-checked={value === inst}
            aria-label={instrumentLabel(inst, t)}
            onClick={() => onChange(inst)}
            className={`tap-target flex min-w-[4rem] flex-col items-center gap-0.5 px-4 py-2 text-sm font-medium transition sm:flex-row sm:gap-1.5 ${
              value === inst
                ? 'bg-accent text-white'
                : 'bg-surface text-ink-soft hover:bg-paper-dark'
            }`}
          >
            <span aria-hidden="true" className="text-lg leading-none sm:text-base">
              {INSTRUMENT_ICON[inst]}
            </span>
            <span className="text-xs sm:text-sm">{instrumentLabel(inst, t)}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
