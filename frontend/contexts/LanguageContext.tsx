'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { languages, type LanguageCode } from '@/lib/i18n';
import type { i18n as I18nInstance } from 'i18next';

// Dynamically import i18next only on client
let i18nInstance: I18nInstance | null = null;

interface LanguageContextType {
  currentLanguage: LanguageCode;
  changeLanguage: (lang: LanguageCode) => void;
  isRTL: boolean;
  isReady: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('en');
  const [isRTL, setIsRTL] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize i18next on client side only
    const initI18n = async () => {
      if (typeof window === 'undefined') return;
      
      const i18n = (await import('i18next')).default;
      const { initReactI18next } = await import('react-i18next');
      
      await i18n
        .use(initReactI18next)
        .init({
          fallbackLng: 'en',
          lng: 'en',
          debug: false,
          interpolation: {
            escapeValue: false,
          },
          resources: {},
          ns: ['common'],
          defaultNS: 'common',
        });
      
      i18nInstance = i18n;
      
      // Load translation files
      const loadPromises = languages.map(async (lang) => {
        try {
          const response = await fetch(`/locales/${lang.code}/common.json`);
          const data = await response.json();
          i18n.addResourceBundle(lang.code, 'common', data);
        } catch (error) {
          console.error(`Failed to load translations for ${lang.code}:`, error);
        }
      });
      
      await Promise.all(loadPromises);
      
      // Initialize from localStorage or default to English
      const savedLang = localStorage.getItem('i18nextLng') as LanguageCode;
      const initialLang = savedLang && languages.some(l => l.code === savedLang) ? savedLang : 'en';
      
      if (initialLang !== 'en') {
        await i18n.changeLanguage(initialLang);
      }
      
      setCurrentLanguage(initialLang);
      const langConfig = languages.find(l => l.code === initialLang);
      setIsRTL(langConfig?.dir === 'rtl');
      
      // Update document direction
      document.documentElement.dir = langConfig?.dir || 'ltr';
      document.documentElement.lang = initialLang;
      
      setIsReady(true);
    };
    
    initI18n();
  }, []);

  const changeLanguage = async (lang: LanguageCode) => {
    if (!i18nInstance) return;
    
    await i18nInstance.changeLanguage(lang);
    setCurrentLanguage(lang);
    
    const langConfig = languages.find(l => l.code === lang);
    const newDir = langConfig?.dir || 'ltr';
    setIsRTL(newDir === 'rtl');
    
    // Update document direction
    document.documentElement.dir = newDir;
    document.documentElement.lang = lang;
    
    // Save to localStorage
    localStorage.setItem('i18nextLng', lang);
  };

  return (
    <LanguageContext.Provider value={{ currentLanguage, changeLanguage, isRTL, isReady }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
