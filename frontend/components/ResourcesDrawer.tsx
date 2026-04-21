'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourcesByCategory } from '@/hooks/useStreamingChat';
import { exportAndDownloadResources } from '@/lib/exportClient';

interface ResourcesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  resources: ResourcesByCategory;
  sessionId: string;
}

export default function ResourcesDrawer({ isOpen, onClose, resources, sessionId }: ResourcesDrawerProps) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Calculate total resources
  const totalResources = Object.values(resources).reduce(
    (sum, resourceList) => sum + resourceList.length,
    0
  );

  // Get categories with resources
  const categories = Object.entries(resources).filter(
    ([_, resourceList]) => resourceList.length > 0
  );

  // Handle export button click
  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);

    try {
      await exportAndDownloadResources(sessionId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to export resources';
      setExportError(errorMessage);
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setActiveCategory(activeCategory === category ? null : category);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="h-full w-80 lg:w-96 bg-[#e0f2fe] shadow-2xl flex flex-col border-l border-[rgba(0,0,0,0.08)]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0EA5E9] to-[#06B6D4] text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">{t('resources.drawerTitle')}</h2>
            <p className="text-sm text-white/80">{totalResources} {t('resources.resourcesFound')}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-white/80 text-2xl"
            aria-label={t('resources.closeButton')}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {totalResources === 0 ? (
            <div className="text-center text-[#64748b] mt-8">
              <p>{t('resources.emptyState')}</p>
              <p className="text-sm mt-2">Ask for resources in your area to see them here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {categories.map(([category, resourceList]) => (
                <div key={category} className="border border-[rgba(0,0,0,0.08)] rounded-lg overflow-hidden">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full bg-[#bae6fd] px-4 py-3 flex justify-between items-center hover:bg-[#7dd3fc] transition-colors"
                  >
                    <span className="font-semibold text-[#0c4a6e]">
                      {t(`resources.categories.${category}`, category)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="bg-gradient-to-r from-[#0EA5E9] to-[#06B6D4] text-white text-xs px-2 py-1 rounded-full">
                        {resourceList.length}
                      </span>
                      <span className={`transform transition-transform text-[#64748b] ${activeCategory === category ? 'rotate-180' : ''}`}>
                        &#9660;
                      </span>
                    </span>
                  </button>

                  {/* Category Resources */}
                  {activeCategory === category && (
                    <div className="p-4 space-y-4 bg-[#bae6fd]/50">
                      {resourceList.map((resource, idx) => (
                        <div key={resource.id} className="border-b border-[rgba(0,0,0,0.08)] pb-4 last:border-b-0 last:pb-0">
                          <h4 className="font-medium text-[#0c4a6e] mb-2">
                            {idx + 1}. {resource.name}
                          </h4>

                          {resource.address && (
                            <p className="text-sm text-[#475569] mb-1 flex items-start">
                              <span className="mr-2 text-[#0284c7]">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                              </span>
                              <span>{resource.address}</span>
                            </p>
                          )}

                          {resource.phone && (
                            <p className="text-sm text-[#475569] mb-1 flex items-start">
                              <span className="mr-2 text-[#0284c7]">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                              </span>
                              <a href={`tel:${resource.phone}`} className="hover:underline text-[#0284c7]">
                                {resource.phone}
                              </a>
                            </p>
                          )}

                          {resource.website && (
                            <p className="text-sm text-[#475569] mb-1 flex items-start">
                              <span className="mr-2 text-[#0284c7]">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                              </span>
                              <a
                                href={resource.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline text-[#0284c7]"
                              >
                                {resource.website}
                              </a>
                            </p>
                          )}

                          {resource.additional_notes && (
                            <p className="text-sm text-[#64748b] mt-2 bg-[rgba(14,165,233,0.08)] p-2 rounded">
                              {resource.additional_notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sticky Export Button Footer */}
        {totalResources > 0 && (
          <div className="border-t border-[rgba(0,0,0,0.08)] bg-[#e0f2fe] px-6 py-4">
            {exportError && (
              <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">
                {exportError}
              </div>
            )}
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full bg-gradient-to-r from-[#0EA5E9] to-[#06B6D4] text-white px-6 py-3 rounded-[30px] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
            >
              {isExporting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exporting...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t('resources.exportButton')}
                </span>
              )}
            </button>
          </div>
        )}
    </div>
  );
}
