import React from 'react';
import { useUiStore, Language } from '../store/uiStore';

const LABELS: Record<Language, string> = { uk: 'UA', en: 'EN' };

export const LanguageSwitcher: React.FC = () => {
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);

  return (
    <div
      className="flex items-center overflow-hidden rounded-md border border-ink-soft/30"
      role="group"
      aria-label="Language"
    >
      {(Object.keys(LABELS) as Language[]).map((lang) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className={`btn-ghost rounded-none font-semibold ${
            language === lang
              ? 'bg-accent text-white hover:bg-accent hover:text-white'
              : 'bg-surface text-ink-soft hover:bg-paper-dark'
          }`}
        >
          {LABELS[lang]}
        </button>
      ))}
    </div>
  );
};
