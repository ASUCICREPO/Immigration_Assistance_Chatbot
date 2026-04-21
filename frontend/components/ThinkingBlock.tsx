'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import { stripThinkTags } from '@/lib/thinkTagParser';

interface ThinkingBlockProps {
  content: string;
  isComplete: boolean;
  isStreaming?: boolean;
}

export default function ThinkingBlock({
  content,
  isComplete,
  isStreaming = false
}: ThinkingBlockProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false); // Start collapsed

  return (
    <div className="mb-3 border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
      {/* Header with expand/collapse toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between
                   bg-linear-to-r from-gray-100 to-gray-50
                   hover:from-gray-200 hover:to-gray-100
                   transition-colors duration-200"
      >
        <div className="flex items-center gap-2">
          {/* Animated thinking icon */}
          {!isComplete && (
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          )}
          {isComplete && (
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span className="text-sm font-medium text-gray-700">
            {!isComplete ? t('chat.thinking') : isExpanded ? t('thinking.expanded') : t('thinking.collapsed')}
          </span>
        </div>

        {/* Chevron icon */}
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform duration-200
                     ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="px-4 py-3 bg-white border-t border-gray-200">
          {content ? (
            <div className="prose prose-sm max-w-none text-gray-700">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {stripThinkTags(content)}
              </ReactMarkdown>
              {/* Streaming cursor */}
              {isStreaming && !isComplete && (
                <span className="inline-block w-0.5 h-4 ml-1 bg-blue-500 animate-pulse"></span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Processing thoughts...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
