'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { USLocation } from '@/data/us-locations-types';
import { useLocationSearch } from '@/hooks/useLocationSearch';
import { useLocation } from '@/contexts/LocationContext';

function getTypeBadge(type: USLocation['type']): string {
  switch (type) {
    case 'state': return 'State';
    case 'city': return 'City';
    case 'county': return 'County';
    case 'zip': return 'ZIP';
    default: return '';
  }
}

export default function LocationAutocomplete() {
  const {
    selectedLocation,
    setSelectedLocation,
    displayLocation,
    hasLocation,
  } = useLocation();

  const { search, results, isSearching, clearResults } = useLocationSearch();

  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setHighlightedIndex(-1);

    if (value.trim()) {
      search(value);
      setIsOpen(true);
    } else {
      clearResults();
      setIsOpen(false);
    }
  }, [search, clearResults]);

  // Handle selection
  const handleSelect = useCallback((location: USLocation) => {
    setSelectedLocation(location);
    setInputValue('');
    setIsOpen(false);
    clearResults();
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  }, [setSelectedLocation, clearResults]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') {
        setInputValue('');
        clearResults();
        setIsOpen(false);
        inputRef.current?.blur();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;

      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          handleSelect(results[highlightedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setInputValue('');
        clearResults();
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;

      case 'Tab':
        // Allow tab but close dropdown
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  }, [isOpen, results, highlightedIndex, handleSelect, clearResults]);

  // Handle blur - clear invalid input
  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Delay to allow click on dropdown item
    setTimeout(() => {
      // Check if focus moved outside the container
      if (!containerRef.current?.contains(document.activeElement)) {
        setInputValue('');
        setIsOpen(false);
        clearResults();
        setHighlightedIndex(-1);
      }
    }, 150);
  }, [clearResults]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setInputValue('');
        setIsOpen(false);
        clearResults();
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clearResults]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const highlightedElement = dropdownRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  // Clear selected location
  const handleClearSelection = useCallback(() => {
    setSelectedLocation(null);
    inputRef.current?.focus();
  }, [setSelectedLocation]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input container */}
      <div className="relative bg-white border border-[#dbdcde] rounded-[30px] h-[46px] flex items-center px-3">
        {/* Location Icon */}
        <div className="w-[21px] h-[21px] mr-2 flex-shrink-0">
          <Image
            src="/location-icon.svg"
            alt="Location"
            width={21}
            height={21}
          />
        </div>

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={() => {
            if (inputValue.trim() && results.length > 0) {
              setIsOpen(true);
            }
          }}
          className="flex-1 text-[#353e4a] text-[14.22px] font-['DM_Sans',sans-serif] outline-none bg-transparent placeholder:text-[#89868d]"
          placeholder="Search city, state, or ZIP code"
          autoComplete="off"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          role="combobox"
        />

        {/* Selected/Current Location Badge */}
        <div
          className={`bg-gradient-to-r from-[#0EA5E9] to-[#06B6D4] rounded-[50px] h-[38px] flex items-center ml-2 cursor-pointer transition-all ${
            hasLocation ? 'px-4 gap-2' : 'w-[38px] justify-center'
          }`}
          onClick={hasLocation ? handleClearSelection : undefined}
          title={hasLocation ? 'Click to clear location' : 'No location set'}
        >
          <Image
            src="/white_location_pin.png"
            alt="Location"
            width={36}
            height={36}
          />
          {hasLocation && (
            <>
              <span className="text-white text-[14.22px] font-['DM_Sans',sans-serif] whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                {displayLocation}
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="ml-1 flex-shrink-0"
              >
                <path
                  d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#dbdcde] rounded-xl shadow-lg max-h-[300px] overflow-y-auto z-50"
          role="listbox"
        >
          {results.map((location, index) => (
            <div
              key={location.id}
              role="option"
              aria-selected={index === highlightedIndex}
              className={`px-4 py-3 cursor-pointer flex items-center justify-between transition-colors ${
                index === highlightedIndex
                  ? 'bg-[rgba(14,165,233,0.08)]'
                  : 'hover:bg-[rgba(14,165,233,0.08)]'
              }`}
              onClick={() => handleSelect(location)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="flex-1 min-w-0">
                <span className="text-[#353e4a] text-[14.22px] font-['DM_Sans',sans-serif] block truncate">
                  {location.displayName}
                </span>
                {location.type === 'zip' && location.city && (
                  <span className="text-[#89868d] text-[12px] font-['DM_Sans',sans-serif] block truncate">
                    {location.city}, {location.stateCode}
                  </span>
                )}
              </div>
              <span className="text-[#89868d] text-[12px] font-['DM_Sans',sans-serif] ml-2 flex-shrink-0">
                {getTypeBadge(location.type)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Loading indicator */}
      {isOpen && isSearching && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#dbdcde] rounded-xl shadow-lg py-3 px-4 z-50">
          <span className="text-[#89868d] text-[14.22px] font-['DM_Sans',sans-serif]">
            Searching...
          </span>
        </div>
      )}

      {/* No results message */}
      {isOpen && !isSearching && inputValue.trim().length >= 2 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#dbdcde] rounded-xl shadow-lg py-3 px-4 z-50">
          <span className="text-[#89868d] text-[14.22px] font-['DM_Sans',sans-serif]">
            No locations found
          </span>
        </div>
      )}
    </div>
  );
}
