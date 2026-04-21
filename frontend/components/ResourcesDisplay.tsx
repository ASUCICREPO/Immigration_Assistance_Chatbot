'use client';

import { useState } from 'react';
import { ResourcesByCategory } from '@/hooks/useStreamingChat';
import ResourceCarousel from './ResourceCarousel';

interface ResourcesDisplayProps {
  resources: ResourcesByCategory;
}

export default function ResourcesDisplay({ resources }: ResourcesDisplayProps) {
  const categories = Object.keys(resources);
  const [selectedCategory, setSelectedCategory] = useState(categories[0] || '');

  if (categories.length === 0) {
    return null;
  }

  const currentResources = selectedCategory ? resources[selectedCategory] : [];

  return (
    <div className="mt-4 w-full">
      {/* Header */}
      <div className="mb-4">
        <h3 className="font-['Nunito_Sans',sans-serif] font-bold text-[22px] text-[#353e4a] mb-2">
          Available Resources
        </h3>
        <p className="font-['Open_Sans',sans-serif] text-[14px] text-[#89868d]">
          Browse resources by category to find services in your area
        </p>
      </div>

      {/* Category Tabs - Browser Style */}
      <div className="mb-0 overflow-x-auto">
        <div className="flex min-w-max">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`
                px-6 py-2.5 rounded-t-[8px] font-['Open_Sans',sans-serif] text-[14px] font-normal
                transition-all duration-200 whitespace-nowrap relative
                ${
                  selectedCategory === category
                    ? 'bg-white text-[#202124] border-t border-l border-r border-[rgba(0,0,0,0.12)] z-10'
                    : 'bg-[#f5f5f5] text-[#89868d] hover:bg-[#ebebeb] border-t border-l border-r border-transparent'
                }
              `}
              style={{
                marginBottom: selectedCategory === category ? '-1px' : '0',
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Carousel */}
      {currentResources.length > 0 ? (
        <ResourceCarousel
          resources={currentResources}
          autoplay={true}
          autoplayDelay={4000}
          pauseOnHover={true}
          loop={true}
        />
      ) : (
        <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[12px] p-6 text-center">
          <p className="font-['Open_Sans',sans-serif] text-[16px] text-[#89868d]">
            No resources available in this category.
          </p>
        </div>
      )}
    </div>
  );
}
