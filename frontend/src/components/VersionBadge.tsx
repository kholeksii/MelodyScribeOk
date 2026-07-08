import React from 'react';
import { useT } from '../i18n';
import { versionLabel, fullVersion } from '../version';

/** Subtle always-visible build identifier shown next to the app title.
 * Hover reveals the full version · commit · build date. */
export const VersionBadge: React.FC = () => {
  const t = useT();
  return (
    <span
      className="cursor-default select-none text-xs font-medium text-ink-soft/50"
      title={`${t('version')}: ${fullVersion}`}
      aria-label={`${t('version')}: ${fullVersion}`}
    >
      {versionLabel}
    </span>
  );
};
