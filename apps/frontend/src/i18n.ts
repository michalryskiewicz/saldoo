import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as nsPL from '@/locales/pl.json';
import * as nsEN from '@/locales/en.json';

export type Locale = 'pl' | 'en';

export const LOCALES: Locale[] = ['pl', 'en'];

/**
 * The namespace both locales are loaded under.
 *
 * Named for what it holds rather than for the language it once held: as `nsPL` it read as "the
 * Polish namespace", and English arriving in it would have made the name a lie.
 */
export const defaultNS = 'translation';

export const resources = {
  pl: { translation: nsPL },
  en: { translation: nsEN },
} as const;

type DotPrefix<T extends string, U extends string> = U extends '' ? T : `${T}.${U}`;

type NestedKeys<T> = {
  [K in keyof T & string]: T[K] extends object ? DotPrefix<K, NestedKeys<T[K]>> : K;
}[keyof T & string];

/**
 * Keys come from the Polish file, which stays the source of truth: the copy is written there and
 * translated outwards. A key that exists only in English would not typecheck, which is the point —
 * and `locales.test.ts` holds the other direction, where a key added to Polish and forgotten in
 * English fails a test rather than silently falling back.
 */
export type TranslationKey = NestedKeys<typeof nsPL>;

const STORAGE_KEY = 'saldoo.locale';

const isLocale = (value: string | null): value is Locale =>
  value !== null && (LOCALES as string[]).includes(value);

/**
 * Whatever was chosen last, and Polish otherwise.
 *
 * Deliberately not the browser's language. The copy is authored in Polish and English is the
 * translation of it, so guessing from `navigator.language` would silently flip the app for
 * somebody who never asked — a change with a real downside and no upside until somebody does ask.
 * Detection is a one-line addition here if that ever becomes the wrong call.
 */
const storedLocale = (): Locale => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    return isLocale(stored) ? stored : 'pl';
  } catch {
    // Storage can throw outright when cookies are blocked, and a locale is not worth a blank page.
    return 'pl';
  }
};

/**
 * Stores the choice and reloads.
 *
 * The reload is not laziness, it is the only correct option available. A great deal of this app
 * calls `i18n.t` at module scope — the table column definitions and the sidebar's items are
 * consts, evaluated once when their module is first imported — so `changeLanguage` alone
 * re-renders the components that read translations during render and leaves every one of those
 * frozen in the previous language. The result is a half-translated screen, which is worse than
 * either language.
 *
 * A reload costs nothing here: the data is local and the vault does not re-lock on refresh.
 * Removing the reload means moving those calls into render, which is a wide change and a separate
 * one.
 */
export const setLocale = (locale: Locale): void => {
  if (locale === i18n.language) return;

  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Nothing to reload into if the choice cannot be remembered, so this is where it stops.
    void i18n.changeLanguage(locale);
    return;
  }

  window.location.reload();
};

i18n.use(initReactI18next).init({
  lng: storedLocale(),
  // Polish is the file the copy is written in, so a key missing anywhere else lands on real words
  // rather than on its own name.
  fallbackLng: 'pl',
  resources,
  defaultNS,
  interpolation: {
    escapeValue: false, // react already safes from xss
  },
});

export default i18n;
