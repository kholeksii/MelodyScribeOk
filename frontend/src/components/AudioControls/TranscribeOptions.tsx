import React from 'react';
import { useT } from '../../i18n';
import { useTapTempo } from '../../hooks/useTapTempo';

interface TranscribeOptionsProps {
  bpm: string;
  setBpm: (bpm: string) => void;
  timeSignature: string;
  setTimeSignature: (ts: string) => void;
  musicalKey: string;
  setMusicalKey: (key: string) => void;
}

const TIME_SIGNATURES = ['4/4', '3/4', '6/8', '2/4'];

const KEYS = [
  'C major', 'C# major', 'D major', 'D# major', 'E major', 'F major',
  'F# major', 'G major', 'G# major', 'A major', 'A# major', 'B major',
  'C minor', 'C# minor', 'D minor', 'D# minor', 'E minor', 'F minor',
  'F# minor', 'G minor', 'G# minor', 'A minor', 'A# minor', 'B minor',
];

export const TranscribeOptions: React.FC<TranscribeOptionsProps> = ({
  bpm, setBpm, timeSignature, setTimeSignature, musicalKey, setMusicalKey,
}) => {
  const { tap, tapCount, computedBpm } = useTapTempo(setBpm);
  const t = useT();

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || (/^\d+$/.test(val) && Number(val) >= 0 && Number(val) <= 300)) {
      setBpm(val);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 mt-4 p-4 bg-paper-dark border border-ink-soft/15 rounded-lg">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-ink-soft">BPM:</label>
        <input
          type="number"
          value={bpm}
          onChange={handleBpmChange}
          placeholder={t('auto')}
          min={40}
          max={300}
          className="w-20 px-2 py-1.5 text-sm border border-ink-soft/30 rounded focus:outline-none focus:ring-2 focus:ring-accent bg-surface"
        />
        <button
          type="button"
          onClick={tap}
          className="px-3 py-1.5 text-sm font-medium border border-ink-soft/30 rounded bg-surface hover:bg-paper-dark transition text-accent"
          title={t('tapHint')}
        >
          {tapCount === 0
            ? t('tapTempo')
            : tapCount < 4
              ? t('tapProgress', { n: tapCount })
              : `BPM: ${computedBpm}`}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-ink-soft">{t('time')}:</label>
        <select
          value={timeSignature}
          onChange={(e) => setTimeSignature(e.target.value)}
          className="px-2 py-1.5 text-sm border border-ink-soft/30 rounded focus:outline-none focus:ring-2 focus:ring-accent bg-surface"
        >
          <option value="">{t('auto')}</option>
          {TIME_SIGNATURES.map((ts) => (
            <option key={ts} value={ts}>{ts}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-ink-soft">{t('key')}:</label>
        <select
          value={musicalKey}
          onChange={(e) => setMusicalKey(e.target.value)}
          className="px-2 py-1.5 text-sm border border-ink-soft/30 rounded focus:outline-none focus:ring-2 focus:ring-accent bg-surface"
        >
          <option value="">{t('auto')}</option>
          {KEYS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>
    </div>
  );
};
