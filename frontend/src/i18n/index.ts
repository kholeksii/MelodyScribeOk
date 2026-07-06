import { useCallback } from 'react';
import { en, TranslationKey } from './en';
import { uk } from './uk';
import { useUiStore, Language } from '../store/uiStore';
import { ApiError } from '../services/apiClient';
import { Instrument } from '../types';

const dicts: Record<Language, Record<TranslationKey, string>> = { en, uk };

export type TFunc = (key: TranslationKey, params?: Record<string, string | number>) => string;

function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match
  );
}

export function translate(
  language: Language,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  return format(dicts[language][key] ?? en[key], params);
}

/** Reactive translation hook — re-renders on language change. */
export function useT(): TFunc {
  const language = useUiStore((s) => s.language);
  return useCallback((key, params) => translate(language, key, params), [language]);
}

/** Non-reactive variant for class components and non-React code. */
export function getT(): TFunc {
  const { language } = useUiStore.getState();
  return (key, params) => translate(language, key, params);
}

const INSTRUMENT_KEYS: Record<Instrument, TranslationKey> = {
  violin: 'violin',
  piano: 'piano',
  guitar: 'guitar',
};

/** Accepts plain strings too (metadata.instrument is not narrowed); unknown values pass through. */
export function instrumentLabel(instrument: Instrument | string, t: TFunc): string {
  const key = INSTRUMENT_KEYS[instrument as Instrument];
  return key ? t(key) : instrument;
}

const DURATION_KEYS: Record<string, TranslationKey> = {
  whole: 'durWhole',
  half: 'durHalf',
  quarter: 'durQuarter',
  eighth: 'durEighth',
  sixteenth: 'durSixteenth',
};

/** "quarter." → "чвертна з крапкою" / "dotted quarter"; unknown values pass through. */
export function durationLabel(duration: string, t: TFunc): string {
  const dotted = duration.endsWith('.');
  const base = dotted ? duration.slice(0, -1) : duration;
  const key = DURATION_KEYS[base];
  if (!key) return duration;
  const label = t(key);
  return dotted ? t('durDotted', { d: label }) : label;
}

// Backend error codes (single ApiResponse envelope, U8) → localized messages
const API_ERROR_KEYS: Record<string, TranslationKey> = {
  validation_error: 'errValidation',
  ffmpeg_missing: 'errFfmpeg',
  bad_request: 'errBadRequest',
  internal: 'errInternal',
};

/** Localize known API/network errors; fall back to the raw message. */
export function localizeError(err: unknown, t: TFunc): string {
  if (err instanceof ApiError) {
    const key = API_ERROR_KEYS[err.code];
    return key ? t(key) : err.message;
  }
  // fetch() rejects with TypeError when the backend is unreachable
  if (err instanceof TypeError) return t('errNetwork');
  return err instanceof Error ? err.message : t('errUnknown');
}
