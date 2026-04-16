'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, type Locale, type TranslationKeys, LOCALE_NAMES, LOCALE_FLAGS } from './translations';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationKeys;
  localeNames: typeof LOCALE_NAMES;
  localeFlags: typeof LOCALE_FLAGS;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'qrlive-language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ko');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved language on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved && translations[saved]) {
        setLocaleState(saved);
      }
    } catch {
      // localStorage not available
    }
    setIsLoaded(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // localStorage not available
    }
    // Update html lang attribute
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale === 'zh' ? 'zh-CN' : newLocale;
    }
  }, []);

  // Update html lang on initial load
  useEffect(() => {
    if (isLoaded && typeof document !== 'undefined') {
      document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale;
    }
  }, [locale, isLoaded]);

  const t = translations[locale];

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, localeNames: LOCALE_NAMES, localeFlags: LOCALE_FLAGS }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export { LOCALE_NAMES, LOCALE_FLAGS };
export type { Locale };
