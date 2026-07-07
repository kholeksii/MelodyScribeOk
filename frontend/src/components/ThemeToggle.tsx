import React from 'react';
import { useThemeToggle } from '../hooks/useTheme';
import { useT } from '../i18n';

export const ThemeToggle: React.FC = () => {
  const { isDark, toggle } = useThemeToggle();
  const t = useT();

  return (
    <button onClick={toggle} title={t('themeToggleTitle')} className="btn-ghost" aria-pressed={isDark}>
      {isDark ? '☀️' : '🌙'}
    </button>
  );
};
