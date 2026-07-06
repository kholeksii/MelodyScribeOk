import { TFunc } from '../i18n';

/** "today" / "2 days ago" / "3 weeks ago" in the active locale. */
export function relativeTime(ts: number, locale: string, t: TFunc): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diffMs = ts - Date.now();
  const diffDays = Math.round(diffMs / 86400000);
  if (Math.abs(diffDays) < 1) return t('today');
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, 'day');
  return rtf.format(Math.round(diffDays / 7), 'week');
}
