'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  onFaqClick: (question: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onToggle?: () => void;
}

const FAQ_QUESTION_KEYS = [
  'sidebar.faq.question1',
  'sidebar.faq.question2',
  'sidebar.faq.question3',
  'sidebar.faq.question4',
];

export default function Sidebar({ onFaqClick, isOpen: isOpenProp = true, onClose, onToggle }: SidebarProps) {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Use prop for desktop, internal state for mobile
  const isDesktopOpen = isOpenProp;
  const isMobileOpen = mobileOpen;

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-28 left-4 z-50 bg-gradient-to-r from-[#0EA5E9] to-[#06B6D4] text-white p-2 rounded-full shadow-lg"
        aria-label="Toggle sidebar"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {mobileOpen ? (
            <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:relative top-[105px] lg:top-0 left-0 h-[calc(100vh-105px)] w-[380px]
          bg-[#e0f2fe] border-r border-[rgba(0,0,0,0.08)]
          overflow-y-auto transition-all duration-300 z-40
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isDesktopOpen ? 'lg:translate-x-0 lg:w-[380px]' : 'lg:-translate-x-full lg:w-0 lg:border-0'}
        `}
      >
        <div className="p-6 space-y-8">
          {/* About Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-['Nunito_Sans',sans-serif] font-extrabold text-[20px] leading-[30px] text-[#0c4a6e]">
                {t('sidebar.aboutUs.title')}
              </h2>
              {/* Mobile close button */}
              <button
                onClick={() => setMobileOpen(false)}
                className="lg:hidden"
                aria-label={t('sidebar.closeButton')}
              >
                <svg width="23" height="23" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 17L17 6M6 6l11 11" stroke="#0c4a6e" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              {/* Desktop close button */}
              <button
                onClick={onClose}
                className="hidden lg:block hover:opacity-70 transition-opacity"
                aria-label={t('sidebar.closeButton')}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M6 18L18 6M6 6l12 12" stroke="#0c4a6e" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <p className="font-['Open_Sans',sans-serif] text-[16px] leading-normal text-[#475569]">
              {t('sidebar.aboutUs.description')}
            </p>
          </section>

          {/* Frequently Asked Questions */}
          <section>
            <h2 className="font-['Nunito',sans-serif] font-bold text-[20px] leading-[30px] text-[#0c4a6e] mb-4">
              {t('sidebar.title')}
            </h2>
            <ul className="space-y-3">
              {FAQ_QUESTION_KEYS.map((questionKey, index) => (
                <li key={index}>
                  <button
                    onClick={() => onFaqClick(t(questionKey))}
                    className="font-['Open_Sans',sans-serif] text-[16px] leading-[20px] text-[#334155] hover:text-[#0284c7] transition-colors text-left w-full"
                  >
                    {t(questionKey)}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Contact Section */}
          <section>
            <h2 className="font-['Nunito',sans-serif] font-bold text-[20px] leading-[30px] text-[#0c4a6e] mb-2">
              {t('sidebar.contact.title')}
            </h2>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
              <p className="font-['Open_Sans',sans-serif] text-[16px] text-[#334155]">
                {t('sidebar.contact.callText')}{' '}
                <a
                  href={`tel:${t('sidebar.contact.phoneNumber')}`}
                  className="font-bold text-[#0284c7] hover:underline"
                >
                  {t('sidebar.contact.phoneNumber')}
                </a>
              </p>
            </div>
          </section>

          {/* Other Resources */}
          <section>
            <h2 className="font-['Nunito',sans-serif] font-bold text-[20px] leading-[30px] text-[#0c4a6e] mb-4">
              {t('sidebar.otherResources.title')}
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                </svg>
                <p className="font-['Open_Sans',sans-serif] font-semibold text-[16px] text-[#334155]">
                  {t('sidebar.otherResources.generalAssistance')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <a
                  href={`mailto:${t('sidebar.otherResources.email')}`}
                  className="font-['Nunito',sans-serif] font-bold text-[20px] text-[#0284c7] hover:text-[#0369a1] underline"
                >
                  {t('sidebar.otherResources.email')}
                </a>
              </div>
            </div>
          </section>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30 top-[105px]"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
