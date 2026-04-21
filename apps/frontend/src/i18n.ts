import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as nsPL from '@/locales/pl.json';

export type Locale = 'pl' | 'en';

export const defaultNS = 'nsPL';
export const resources = {
  pl: {
    nsPL,
  },
} as const;

type DotPrefix<T extends string, U extends string> = U extends '' ? T : `${T}.${U}`;

type NestedKeys<T> = {
  [K in keyof T & string]: T[K] extends object ? DotPrefix<K, NestedKeys<T[K]>> : K;
}[keyof T & string];

export type TranslationKey = NestedKeys<typeof nsPL>;

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    lng: 'pl', // language to use, more information here: https://www.i18next.com/overview/configuration-options#languages-namespaces-resources
    // you can use the i18n.changeLanguage function to change the language manually: https://www.i18next.com/overview/api#changelanguage
    // if you're using a language detector, do not define the lng option
    resources,
    defaultNS,
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
