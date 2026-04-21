'use client';

import { useState, useEffect, useRef } from 'react';
import { Resource } from '@/hooks/useStreamingChat';

interface ResourceCarouselProps {
  resources: Resource[];
  autoplay?: boolean;
  autoplayDelay?: number;
  pauseOnHover?: boolean;
  loop?: boolean;
}

export default function ResourceCarousel({
  resources,
  autoplay = true,
  autoplayDelay = 4000,
  pauseOnHover = true,
  loop = true,
}: ResourceCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const autoplayRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-advance slides
  useEffect(() => {
    if (!autoplay || isPaused || resources.length <= 1) {
      return;
    }

    autoplayRef.current = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        if (prevIndex === resources.length - 1) {
          return loop ? 0 : prevIndex;
        }
        return prevIndex + 1;
      });
    }, autoplayDelay);

    return () => {
      if (autoplayRef.current) {
        clearInterval(autoplayRef.current);
      }
    };
  }, [autoplay, autoplayDelay, isPaused, loop, resources.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => {
      if (prevIndex === 0) {
        return loop ? resources.length - 1 : 0;
      }
      return prevIndex - 1;
    });
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => {
      if (prevIndex === resources.length - 1) {
        return loop ? 0 : prevIndex;
      }
      return prevIndex + 1;
    });
  };

  const handleMouseEnter = () => {
    if (pauseOnHover) {
      setIsPaused(true);
    }
  };

  const handleMouseLeave = () => {
    if (pauseOnHover) {
      setIsPaused(false);
    }
  };

  if (resources.length === 0) {
    return null;
  }

  const currentResource = resources[currentIndex];

  return (
    <div
      className="relative w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Carousel Content */}
      <div className="bg-white border border-[rgba(0,0,0,0.12)] rounded-b-[12px] rounded-t-none border-t p-6 min-h-[280px] transition-all duration-300">
        <div className="space-y-4">
          {/* Resource Name */}
          <h3 className="font-['Nunito_Sans',sans-serif] font-bold text-[20px] text-[#353e4a]">
            {currentResource.name}
          </h3>

          {/* Resource Details */}
          <div className="space-y-3 font-['Open_Sans',sans-serif] text-[16px]">
            {/* Address */}
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-[#0EA5E9] flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <p className="text-[#353e4a]">{currentResource.address}</p>
            </div>

            {/* Phone */}
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-[#0EA5E9] flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              <a
                href={`tel:${currentResource.phone}`}
                className="text-[#0EA5E9] hover:underline font-semibold"
              >
                {currentResource.phone}
              </a>
            </div>

            {/* Website */}
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-[#0EA5E9] flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
              <a
                href={currentResource.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0EA5E9] hover:underline"
              >
                Visit Website
              </a>
            </div>

            {/* Additional Notes */}
            {currentResource.additional_notes && (
              <div className="mt-4 p-3 bg-[rgba(247,243,237,0.43)] rounded-[8px]">
                <p className="text-[14px] text-[#353e4a] leading-relaxed">
                  {currentResource.additional_notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {resources.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-100 rounded-full p-2 shadow-lg transition-all duration-200"
            aria-label="Previous resource"
          >
            <svg
              className="w-6 h-6 text-[#0EA5E9]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-100 rounded-full p-2 shadow-lg transition-all duration-200"
            aria-label="Next resource"
          >
            <svg
              className="w-6 h-6 text-[#0EA5E9]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {resources.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {resources.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                index === currentIndex
                  ? 'bg-[#0EA5E9] w-6'
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Counter */}
      {resources.length > 1 && (
        <div className="text-center mt-2 font-['Open_Sans',sans-serif] text-[14px] text-[#89868d]">
          {currentIndex + 1} of {resources.length}
        </div>
      )}
    </div>
  );
}
