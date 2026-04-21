'use client';

import Header from '@/components/Header';
import ChatInterface from '@/components/ChatInterface';
import { LocationProvider } from '@/contexts/LocationContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Home() {
  const { isReady } = useLanguage();

  // Show loading state until translations are ready
  if (!isReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0EA5E9]"></div>
          <p className="text-[#89868d] text-[16px] font-['Open_Sans',sans-serif]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <LocationProvider>
      <div className="h-screen flex flex-col bg-white">
        {/* Header */}
        <Header />

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden mt-[105px]">
          {/* Sidebar and Chat Interface */}
          <ChatInterface />
        </div>
      </div>
    </LocationProvider>
  );
}
