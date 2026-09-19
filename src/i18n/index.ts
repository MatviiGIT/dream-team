import { ru } from './ru';

export const locales = {
  ru,
} as const;

export type Locale = keyof typeof locales;
export const defaultLocale: Locale = 'ru';
export const t = locales[defaultLocale];
