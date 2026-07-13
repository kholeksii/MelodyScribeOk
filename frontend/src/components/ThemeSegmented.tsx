import React from 'react';
import { useUiStore, Theme } from '../store/uiStore';
import { useT } from '../i18n';

/** Light · Dark · Auto segmented control (SPEC.md §4 phone overflow sheet). */
export const ThemeSegmented: React.FC = () => {
  const t = useT();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const options: { value: Theme; label: string }[] = [
    { value: 'light', label: t('themeLight') },
    { value: 'dark', label: t('themeDark') },
    { value: 'system', label: t('themeAuto') },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={t('themeToggleTitle')}
      className="flex overflow-hidden rounded-md border border-ink-soft/30"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={theme === opt.value}
          onClick={() => setTheme(opt.value)}
          className={`tap-target flex-1 px-3 py-2 text-sm font-medium transition ${
            theme === opt.value
              ? 'bg-accent text-white'
              : 'bg-surface text-ink-soft hover:bg-paper-dark'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};
