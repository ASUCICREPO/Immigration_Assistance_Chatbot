'use client';

import { useState } from 'react';
import Image from 'next/image';
import LocationAutocomplete from './LocationAutocomplete';
import { useLanguage } from '@/contexts/LanguageContext';
import { languages } from '@/lib/i18n';

export default function Header() {
  const { currentLanguage, changeLanguage } = useLanguage();
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);

  const currentLangConfig = languages.find(l => l.code === currentLanguage);
  return (
    <header className="fixed top-0 left-0 right-0 bg-white shadow-[0px_4px_12px_0px_rgba(0,0,0,0.1)] z-50">
      {/* Gradient accent bar */}
      <div className="h-1 bg-gradient-to-r from-[#0EA5E9] to-[#06B6D4]" />
      <div className="h-[100px] flex items-center justify-between px-6">
        {/* Logo */}
        <div className="flex-shrink-0 flex items-center gap-3">
          <Image
            src="/assistant-avatar-new.png"
            alt="Resource Assistant"
            width={52}
            height={52}
            priority
            className="rounded-xl"
          />
          <div className="flex flex-col">
            <span className="text-[20px] font-bold text-[#1a2332] font-['DM_Sans',sans-serif] leading-tight">
              Resource Assistant
            </span>
            <span className="text-[14px] text-[#6b7280] font-['DM_Sans',sans-serif]">
              AI-Powered Support Tool
            </span>
          </div>
        </div>

        {/* Location Autocomplete */}
        <div className="flex-1 max-w-[738px] mx-auto">
          <LocationAutocomplete />
        </div>

        {/* Language Selector */}
        <div className="flex-shrink-0 ms-6 relative">
          <button
            onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
            className="bg-gradient-to-r from-[#0EA5E9] to-[#06B6D4] text-white px-6 py-2 rounded-[30px] text-[14px] font-['DM_Sans',sans-serif] flex items-center gap-2 hover:shadow-md transition-shadow"
          >
            <Image
              src="/globe.svg"
              alt="Language"
              width={16}
              height={16}
              className="opacity-90 brightness-0 invert"
            />
            {currentLangConfig?.name || 'English'}
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1.5L6 6.5L11 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Language Dropdown Menu */}
          {isLanguageMenuOpen && (
            <>
              {/* Backdrop to close menu */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsLanguageMenuOpen(false)}
              />

              {/* Dropdown */}
              <div className="absolute end-0 mt-2 w-[200px] bg-white rounded-[12px] shadow-lg z-50 py-2 max-h-[400px] overflow-y-auto">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      changeLanguage(lang.code);
                      setIsLanguageMenuOpen(false);
                    }}
                    className={`w-full text-start px-4 py-2 hover:bg-[rgba(14,165,233,0.08)] transition-colors ${
                      currentLanguage === lang.code ? 'bg-[rgba(14,165,233,0.08)] font-semibold' : ''
                    }`}
                  >
                    <span className="text-[14px] font-['DM_Sans',sans-serif] text-[#353e4a]">
                      {lang.name}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
