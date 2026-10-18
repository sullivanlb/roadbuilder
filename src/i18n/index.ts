import { ref } from 'vue';
import type { ExportError, ProjectErrorDetail, TrackIssue } from '../domain/diagnostics';
import { catalogues } from './catalogues';
import type { Locale } from './catalogues';
import type { MessageKey, MessageParams } from './fr';

export type { Locale } from './catalogues';
export { LOCALES } from './catalogues';

export const LOCALE_STORAGE_KEY = 'roadbuilder.locale';

function storedLocale(): Locale {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(LOCALE_STORAGE_KEY) === 'en'
      ? 'en'
      : 'fr';
  } catch {
    return 'fr';
  }
}

/** Current interface language; every t() or format call reads it, so views follow it. */
export const locale = ref<Locale>(storedLocale());

/** Mirrors the language onto the root element so assistive tools and CSS follow it. */
export function initLocale() {
  try {
    document.documentElement.lang = locale.value;
  } catch {
    /* Outside a browser the attribute stays unset. */
  }
}

export function setLocale(next: Locale) {
  locale.value = next;
  initLocale();
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    /* The preference stays in memory when storage is unavailable. */
  }
}

/** Formats a number with the separators of the current language. */
export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString(locale.value === 'fr' ? 'fr-FR' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Looks up an interface string and fills its {placeholders}. */
export function t<K extends MessageKey>(key: K, params?: MessageParams<K>): string {
  const template = catalogues[locale.value].messages[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String((params as Record<string, string | number>)[name])
      : token,
  );
}

export function formatProjectError(detail: ProjectErrorDetail): string {
  return catalogues[locale.value].projectError(detail);
}

export function formatTrackIssue(issue: TrackIssue): string {
  return catalogues[locale.value].trackIssue(issue);
}

export function formatExportError(error: ExportError): string {
  return catalogues[locale.value].exportError(error);
}
