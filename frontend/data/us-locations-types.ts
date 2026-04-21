export interface USLocation {
  id: string;
  displayName: string;      // "Dallas, TX" or "75001"
  searchableText: string;   // lowercase for matching
  type: 'state' | 'city' | 'county' | 'zip';
  state: string;
  stateCode: string;
  city?: string;
  county?: string;
  zipCode?: string;
}

export type LocationTier = 'tier1' | 'tier2';
