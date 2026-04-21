import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Language configuration with RTL support
export const languages = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'hi', name: 'हिन्दी', dir: 'ltr' },
  { code: 'fa-AF', name: 'دری', dir: 'rtl' },
  { code: 'ps', name: 'پښتو', dir: 'rtl' },
  { code: 'es', name: 'Español', dir: 'ltr' },
  { code: 'fr', name: 'Français', dir: 'ltr' },
  { code: 'ht', name: 'Kreyòl Ayisyen', dir: 'ltr' },
  { code: 'pt', name: 'Português', dir: 'ltr' },
  { code: 'uk', name: 'Українська', dir: 'ltr' },
  { code: 'sw', name: 'Kiswahili', dir: 'ltr' },
  { code: 'ar', name: 'العربية', dir: 'rtl' },
] as const;

export type LanguageCode = typeof languages[number]['code'];

// NOTE: i18n is initialized in LanguageContext to avoid duplicate initialization.
export default i18n;
