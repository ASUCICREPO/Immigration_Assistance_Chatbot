'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import ThinkingBlock from './ThinkingBlock';
import ResourcesDisplay from './ResourcesDisplay';
import ResourcesDrawer from './ResourcesDrawer';
import { useStreamingChat } from '@/hooks/useStreamingChat';
import { useLocation } from '@/contexts/LocationContext';
import { stripThinkTags } from '@/lib/thinkTagParser';

export default function ChatInterface() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const { effectiveLocation } = useLocation();
  const { sendMessage, messages, isStreaming, error, sessionId, allResources } = useStreamingChat({
    locationOverride: effectiveLocation,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Calculate total resources count
  const totalResourcesCount = Object.values(allResources).reduce(
    (sum, resourceList) => sum + resourceList.length,
    0
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    await sendMessage(input);
    setInput('');
  };

  const handleFaqClick = (question: string) => {
    sendMessage(question);
  };

  return (
    <>
      {/* Sidebar */}
      <Sidebar
        onFaqClick={handleFaqClick}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Desktop Sidebar Expand Button - shown when sidebar is closed */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="hidden lg:flex fixed top-[120px] start-4 z-50 bg-gradient-to-r from-[#0EA5E9] to-[#06B6D4] text-white p-2 rounded-full shadow-lg hover:shadow-xl transition-shadow items-center justify-center"
          aria-label={t('sidebar.openButton')}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {/* Main Content Area - Chat and Resources Side-Panel */}
      <div className="flex-1 flex flex-row h-full overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {messages.length === 0 && !error && (
            <div className="flex items-center justify-center h-full">
              <p className="text-[#89868d] text-[18px] font-['Open_Sans',sans-serif]">
                {t('chat.emptyState')}
              </p>
            </div>
          )}

          <div className="max-w-[900px] mx-auto space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* Assistant Avatar */}
              {message.role === 'assistant' && (
                <div className="flex-shrink-0">
                  <Image
                    src="/assistant-avatar-new.png"
                    alt="Assistant"
                    width={45}
                    height={45}
                    className="rounded-full"
                  />
                </div>
              )}

              {/* Message Content */}
              {message.role === 'assistant' ? (
                <div className="flex-1 max-w-[80%] space-y-2">
                  {/* Thinking/Reasoning Block (if exists) */}
                  {message.reasoning && (
                    <ThinkingBlock
                      content={message.reasoning.content}
                      isComplete={message.reasoning.isComplete}
                      isStreaming={isStreaming && !message.reasoning.isComplete}
                    />
                  )}

                  {/* Final Response */}
                  {message.content ? (
                    <div className="bg-white border border-[#0EA5E9]/30 rounded-[12px] p-6 shadow-sm">
                      <div className="font-['Open_Sans',sans-serif] text-[16px] leading-[24px] text-black prose prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                            strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                            code: ({ children }) => <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>,
                            pre: ({ children }) => <pre className="bg-gray-100 p-3 rounded overflow-x-auto mb-2">{children}</pre>,
                            a: ({ href, children }) => (
                              <a href={href} className="text-[#0EA5E9] hover:underline" target="_blank" rel="noopener noreferrer">
                                {children}
                              </a>
                            ),
                            h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-3">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-2">{children}</h3>,
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-[#0EA5E9]/30 pl-4 italic my-2">{children}</blockquote>
                            ),
                          }}
                        >
                          {stripThinkTags(message.content)}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    !message.reasoning && (
                      <div className="bg-white border border-[#0EA5E9]/30 rounded-[12px] p-6 shadow-sm">
                        <span className="flex items-center gap-2 text-[#89868d]">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0EA5E9]"></div>
                          {t('chat.thinking')}
                        </span>
                      </div>
                    )
                  )}

                  {/* Resources Carousel (if resources exist) */}
                  {message.resources && Object.keys(message.resources).length > 0 && (
                    <ResourcesDisplay resources={message.resources} />
                  )}
                </div>
              ) : (
                <div className="max-w-[80%] rounded-[12px] p-6 bg-gradient-to-r from-[#0EA5E9] to-[#06B6D4] text-white shadow-sm">
                  <div className="font-['Open_Sans',sans-serif] text-[16px] leading-[24px]">
                    {message.content}
                  </div>
                </div>
              )}
            </div>
          ))}

          {error && (
            <div className="bg-red-50 border border-red-300 rounded-[12px] p-6">
              <p className="font-['Open_Sans',sans-serif] font-semibold text-[16px] text-red-700">
                {t('chat.errorLabel')}
              </p>
              <p className="font-['Open_Sans',sans-serif] text-[16px] text-red-600 mt-1">
                {error.message}
              </p>
            </div>
          )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 px-8 py-6 border-t border-[rgba(0,0,0,0.08)]">
        <form onSubmit={handleSubmit} className="max-w-[851px] mx-auto">
          <div className="bg-[rgba(191,191,191,0.12)] rounded-[40px] p-6 flex items-center gap-4 focus-within:ring-2 focus-within:ring-[#0EA5E9]/30 transition-shadow">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isStreaming}
              placeholder={t('chat.inputPlaceholder')}
              className="flex-1 bg-transparent outline-none font-['Poppins',sans-serif] text-[18px] text-black placeholder:text-[rgba(7,16,22,0.5)] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="flex-shrink-0 w-[36px] h-[36px] bg-gradient-to-r from-[#0EA5E9] to-[#06B6D4] rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:shadow-md"
              aria-label={t('chat.sendButton')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </form>
        </div>

        {/* Resources Drawer Toggle Button - Always visible when drawer is closed */}
        {!isDrawerOpen && (
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="fixed bottom-8 end-8 bg-gradient-to-r from-[#0EA5E9] to-[#06B6D4] text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-shadow z-30 flex items-center gap-2"
            aria-label={t('resources.viewButton')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {totalResourcesCount > 0 && (
              <span className="font-medium">{totalResourcesCount}</span>
            )}
          </button>
        )}
        </div>

        {/* Resources Side-Panel */}
        <ResourcesDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          resources={allResources}
          sessionId={sessionId}
        />
      </div>
    </>
  );
}
