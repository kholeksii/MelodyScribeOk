import React from 'react';
import { Instrument } from '../../types';
import { useT, instrumentLabel } from '../../i18n';

interface InstrumentSelectorProps {
  value: Instrument;
  onChange: (value: Instrument) => void;
}

const INSTRUMENTS: Instrument[] = ['violin', 'piano', 'guitar'];

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
            onClick={() => onChange(inst)}
            className={`tap-target px-4 py-2 text-sm font-medium transition ${
              value === inst
                ? 'bg-accent text-white'
                : 'bg-surface text-ink-soft hover:bg-paper-dark'
            }`}
          >
            {instrumentLabel(inst, t)}
          </button>
        ))}
      </div>
    </div>
  );
};
