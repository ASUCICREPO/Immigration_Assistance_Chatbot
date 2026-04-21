'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { USLocation } from '@/data/us-locations-types';
import { useGeolocation } from '@/hooks/useGeolocation';

interface LocationContextValue {
  // Selected location from autocomplete (null if none selected)
  selectedLocation: USLocation | null;

  // Set the selected location
  setSelectedLocation: (location: USLocation | null) => void;

  // Clear the selected location
  clearSelectedLocation: () => void;

  // Geolocation data (if available)
  geoLocation: {
    formattedLocation?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  } | null;

  // Whether geolocation is still loading
  geoLocationLoading: boolean;

  // The effective location string to use for the chat API
  // Priority: selectedLocation > geoLocation
  effectiveLocation: string | undefined;

  // Whether there's any location available (selected or geo)
  hasLocation: boolean;

  // Display name for the current location
  displayLocation: string | undefined;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [selectedLocation, setSelectedLocationState] = useState<USLocation | null>(null);
  const { location: geoLocation, loading: geoLocationLoading } = useGeolocation();

  const setSelectedLocation = useCallback((location: USLocation | null) => {
    setSelectedLocationState(location);
  }, []);

  const clearSelectedLocation = useCallback(() => {
    setSelectedLocationState(null);
  }, []);

  // Compute effective location
  const effectiveLocation = useMemo(() => {
    if (selectedLocation) {
      // For cities, return "City, State"
      if (selectedLocation.type === 'city' && selectedLocation.city) {
        return `${selectedLocation.city}, ${selectedLocation.stateCode}`;
      }
      // For states, return just the state name
      if (selectedLocation.type === 'state') {
        return selectedLocation.state;
      }
      // For ZIP codes, return the ZIP code
      if (selectedLocation.type === 'zip' && selectedLocation.zipCode) {
        return selectedLocation.zipCode;
      }
      // For counties, return "County, State"
      if (selectedLocation.type === 'county' && selectedLocation.county) {
        return `${selectedLocation.county}, ${selectedLocation.stateCode}`;
      }
      // Fallback to display name
      return selectedLocation.displayName;
    }

    // Fall back to geolocation
    return geoLocation?.formattedLocation;
  }, [selectedLocation, geoLocation]);

  // Display location for UI
  const displayLocation = useMemo(() => {
    if (selectedLocation) {
      return selectedLocation.displayName;
    }
    return geoLocation?.formattedLocation;
  }, [selectedLocation, geoLocation]);

  const hasLocation = !!(selectedLocation || geoLocation?.formattedLocation);

  const value: LocationContextValue = useMemo(() => ({
    selectedLocation,
    setSelectedLocation,
    clearSelectedLocation,
    geoLocation,
    geoLocationLoading,
    effectiveLocation,
    hasLocation,
    displayLocation,
  }), [
    selectedLocation,
    setSelectedLocation,
    clearSelectedLocation,
    geoLocation,
    geoLocationLoading,
    effectiveLocation,
    hasLocation,
    displayLocation,
  ]);

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}

export default LocationContext;
