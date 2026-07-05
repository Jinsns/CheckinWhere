/**
 * Convert ScenicSpot data to POI type for app integration
 */
import type { ScenicSpot, ScenicSearchItem } from '@/types/scenic';
import type { POI } from '@/types';

/**
 * Convert scenic search item to POI
 */
export function scenicSearchItemToPOI(spot: ScenicSearchItem): POI {
  return {
    id: `scenic-${spot.id}`,
    name: spot.name,
    address: `${spot.province}${spot.city}`,
    location: spot.location || { lat: 0, lng: 0 },
    type: '风景名胜',
    typecode: '110000', // AMAP scenic spot typecode
    photos: [],
    selected: false,
  };
}

/**
 * Convert full scenic spot to POI with more details
 */
export function scenicSpotToPOI(spot: ScenicSpot): POI {
  return {
    id: `scenic-${spot.id}`,
    name: spot.name,
    address: `${spot.province}${spot.city}${spot.county}`,
    location: spot.location || { lat: 0, lng: 0 },
    type: '风景名胜',
    typecode: '110000',
    photos: spot.images.map(img => img.url),
    selected: false,
  };
}

/**
 * Get scenic spots for a specific city
 */
export function getScenicSpotsByCity(
  allSpots: ScenicSearchItem[],
  province: string,
  city: string
): ScenicSearchItem[] {
  return allSpots.filter(s => s.province === province && s.city === city);
}
