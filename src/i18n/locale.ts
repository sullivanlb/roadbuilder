/** Languages shipped with the editor; French is the source of truth and the default. */
export type Locale = 'fr' | 'en';

export const LOCALES: readonly Locale[] = ['fr', 'en'];

export const LOCALE_STORAGE_KEY = 'roadbuilder.locale';

/** Reads the stored language; outside a browser, or without a choice, French is used. */
export function storedLocale(): Locale {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(LOCALE_STORAGE_KEY) === 'en'
      ? 'en'
      : 'fr';
  } catch {
    return 'fr';
  }
}
