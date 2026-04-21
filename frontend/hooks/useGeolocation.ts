import { useState, useEffect, useCallback } from 'react';

export interface LocationData {
  zipCode?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  formattedLocation?: string;
}

interface GeolocationState {
  location: LocationData | null;
  loading: boolean;
  error: GeolocationPositionError | Error | null;
}

/**
 * Hook to fetch user's location using browser Geolocation API
 * Attempts to get ZIP code via reverse geocoding, falls back gracefully
 * Listens for permission changes to update location when user grants access
 */
export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    location: null,
    loading: true,
    error: null,
  });

  const fetchLocation = useCallback(() => {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setState({
        location: null,
        loading: false,
        error: new Error('Geolocation not supported'),
      });
      return;
    }

    setState(prev => ({ ...prev, loading: true }));

    // Request location
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          // Attempt reverse geocoding to get ZIP code
          const locationData = await reverseGeocode(latitude, longitude);

          setState({
            location: locationData,
            loading: false,
            error: null,
          });
        } catch (error) {
          // If reverse geocoding fails, still provide coordinates
          setState({
            location: {
              latitude,
              longitude,
              formattedLocation: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            },
            loading: false,
            error: null, // Silent failure for reverse geocoding
          });
        }
      },
      (error) => {
        // Silent failure - no error shown to user
        // Manager will infer location from messages
        setState({
          location: null,
          loading: false,
          error: error,
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes cache
      }
    );
  }, []);

  useEffect(() => {
    // Initial location fetch
    fetchLocation();

    // Track cleanup function for permission listener
    let cleanupPermissionListener: (() => void) | null = null;

    // Listen for permission changes using the Permissions API
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((permissionStatus) => {
        const handlePermissionChange = () => {
          if (permissionStatus.state === 'granted') {
            // User just granted permission, fetch location again
            fetchLocation();
          }
        };

        permissionStatus.addEventListener('change', handlePermissionChange);

        // Store cleanup function
        cleanupPermissionListener = () => {
          permissionStatus.removeEventListener('change', handlePermissionChange);
        };
      }).catch(() => {
        // Permissions API not supported, fall back to just the initial fetch
      });
    }

    // Cleanup on unmount
    return () => {
      if (cleanupPermissionListener) {
        cleanupPermissionListener();
      }
    };
  }, [fetchLocation]);

  return state;
}

/**
 * Reverse geocode coordinates to get ZIP code and location details
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 */
async function reverseGeocode(lat: number, lon: number): Promise<LocationData> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Resource-Assistant',
    },
  });

  if (!response.ok) {
    throw new Error('Reverse geocoding failed');
  }

  const data = await response.json();
  const address = data.address || {};

  // Build location data with priority on ZIP code
  const locationData: LocationData = {
    latitude: lat,
    longitude: lon,
  };

  // Try to extract ZIP code (called postcode in OSM)
  if (address.postcode) {
    locationData.zipCode = address.postcode;
  }

  // Extract city (can be city, town, village, etc.)
  const city = address.city || address.town || address.village || address.municipality;
  if (city) {
    locationData.city = city;
  }

  // Extract state
  if (address.state) {
    locationData.state = address.state;
  }

  // Build formatted location string
  // Priority: ZIP Code > City, State > State > Coordinates
  if (locationData.zipCode) {
    locationData.formattedLocation = locationData.zipCode;
  } else if (locationData.city && locationData.state) {
    locationData.formattedLocation = `${locationData.city}, ${locationData.state}`;
  } else if (locationData.state) {
    locationData.formattedLocation = locationData.state;
  } else {
    locationData.formattedLocation = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }

  return locationData;
}
