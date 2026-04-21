import { useState, useCallback, useRef, useEffect } from 'react';
import { USLocation } from '@/data/us-locations-types';
import tier1Locations from '@/data/us-locations-tier1';

// Track if tier 2 data has been loaded
let tier2Data: USLocation[] | null = null;
let tier2LoadPromise: Promise<USLocation[]> | null = null;

// Lazy load tier 2 data
async function loadTier2Data(): Promise<USLocation[]> {
  if (tier2Data) return tier2Data;

  if (tier2LoadPromise) return tier2LoadPromise;

  tier2LoadPromise = import('@/data/us-locations-tier2').then((module) => {
    tier2Data = module.tier2Locations;
    return tier2Data;
  });

  return tier2LoadPromise;
}

interface SearchResult {
  location: USLocation;
  matchType: 'exact' | 'prefix' | 'contains';
  score: number;
}

function scoreMatch(searchableText: string, query: string, type: USLocation['type']): SearchResult['matchType'] | null {
  const lowerQuery = query.toLowerCase();
  const lowerText = searchableText.toLowerCase();

  // Check exact match (for zip codes or exact city names)
  if (lowerText === lowerQuery || lowerText.startsWith(lowerQuery + ' ')) {
    return 'exact';
  }

  // Check prefix match
  if (lowerText.startsWith(lowerQuery)) {
    return 'prefix';
  }

  // Check if any word starts with the query
  const words = lowerText.split(' ');
  if (words.some(word => word.startsWith(lowerQuery))) {
    return 'prefix';
  }

  // Check contains match
  if (lowerText.includes(lowerQuery)) {
    return 'contains';
  }

  return null;
}

function getTypeScore(type: USLocation['type']): number {
  // Higher score = more relevant for text searches
  switch (type) {
    case 'city': return 4;
    case 'state': return 3;
    case 'county': return 2;
    case 'zip': return 1;
    default: return 0;
  }
}

function getMatchScore(matchType: SearchResult['matchType']): number {
  switch (matchType) {
    case 'exact': return 100;
    case 'prefix': return 50;
    case 'contains': return 10;
    default: return 0;
  }
}

export interface UseLocationSearchOptions {
  debounceMs?: number;
  maxResults?: number;
}

export function useLocationSearch(options: UseLocationSearchOptions = {}) {
  const { debounceMs = 150, maxResults = 10 } = options;

  const [results, setResults] = useState<USLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [tier2Loaded, setTier2Loaded] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastQueryRef = useRef<string>('');

  // Load tier 2 data when needed
  const ensureTier2Loaded = useCallback(async () => {
    if (!tier2Loaded && !tier2Data) {
      await loadTier2Data();
      setTier2Loaded(true);
    }
  }, [tier2Loaded]);

  const performSearch = useCallback(async (query: string): Promise<USLocation[]> => {
    if (!query || query.length < 2) {
      return [];
    }

    const trimmedQuery = query.trim().toLowerCase();
    const isNumericQuery = /^\d+$/.test(trimmedQuery);

    // Determine if we need tier 2 data
    // Load tier 2 for ZIP code searches (3+ digits) or county searches
    const needsTier2 = (isNumericQuery && trimmedQuery.length >= 3) ||
                       trimmedQuery.includes('county');

    let searchPool: USLocation[] = [...tier1Locations];

    if (needsTier2) {
      await ensureTier2Loaded();
      if (tier2Data) {
        searchPool = [...searchPool, ...tier2Data];
      }
    }

    const searchResults: SearchResult[] = [];

    for (const location of searchPool) {
      // For numeric queries, prioritize ZIP codes
      if (isNumericQuery && location.type !== 'zip') {
        continue;
      }

      const matchType = scoreMatch(location.searchableText, trimmedQuery, location.type);

      if (matchType) {
        const matchScore = getMatchScore(matchType);
        const typeScore = isNumericQuery ? 0 : getTypeScore(location.type);
        const score = matchScore + typeScore;

        searchResults.push({
          location,
          matchType,
          score,
        });
      }
    }

    // Sort by score (descending), then alphabetically
    searchResults.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.location.displayName.localeCompare(b.location.displayName);
    });

    return searchResults.slice(0, maxResults).map(r => r.location);
  }, [maxResults, ensureTier2Loaded]);

  const search = useCallback((query: string) => {
    lastQueryRef.current = query;

    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Clear results for empty queries
    if (!query || query.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // Debounce the search
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const searchResults = await performSearch(query);
        // Only update if this is still the latest query
        if (lastQueryRef.current === query) {
          setResults(searchResults);
        }
      } catch (error) {
        console.error('Location search error:', error);
        setResults([]);
      } finally {
        if (lastQueryRef.current === query) {
          setIsSearching(false);
        }
      }
    }, debounceMs);
  }, [debounceMs, performSearch]);

  // Clear results
  const clearResults = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setResults([]);
    setIsSearching(false);
    lastQueryRef.current = '';
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    search,
    results,
    isSearching,
    clearResults,
    tier2Loaded,
  };
}

export default useLocationSearch;
