import React from 'react';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { fullVersion } from '../version';

interface ShortcutHelpProps {
  visible: boolean;
  onClose: () => void;
}

const ROWS: { keys: string; label: TranslationKey }[] = [
  { keys: '← →', label: 'scSelect' },
  { keys: '↑ ↓', label: 'scSemitone' },
  { keys: 'Shift + ↑ ↓', label: 'scOctave' },
  { keys: '1 – 5', label: 'scDuration' },
  { keys: '.', label: 'scDotted' },
  { keys: 'R', label: 'scRest' },
  { keys: 'Backspace / Delete', label: 'scDelete' },
  { keys: 'Enter', label: 'scInsert' },
  { keys: 'Esc', label: 'scDeselect' },
  { keys: 'Space', label: 'scPlay' },
  { keys: '?', label: 'scHelp' },
];

export const ShortcutHelp: React.FC<ShortcutHelpProps> = ({ visible, onClose }) => {
  const t = useT();

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={t('shortcutsTitle')}
        className="w-full max-w-md rounded-lg border border-ink-soft/15 bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">{t('shortcutsTitle')}</h2>
          <button onClick={onClose} className="btn-ghost" title={t('close')}>
            ✕
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b border-ink-soft/10 last:border-0">
                <td className="py-1.5 pr-4 align-top">
                  <kbd className="rounded border border-ink-soft/30 bg-paper-dark px-1.5 py-0.5 font-mono text-xs text-ink">
                    {row.keys}
                  </kbd>
                </td>
                <td className="py-1.5 text-ink-soft">{t(row.label)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 border-t border-ink-soft/10 pt-3 text-xs text-ink-soft/70">
          {t('version')}: {fullVersion}
        </div>
      </div>
    </div>
  );
};
