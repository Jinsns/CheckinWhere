/**
 * 5A Scenic Spot type definitions
 */

export interface ScenicImage {
  url: string;
  caption?: string;
  keywords?: string[];
  license?: string;
}

export interface ScenicSpot {
  id: string;
  name: string;
  level: '5A';
  province: string;
  city: string;
  county: string;
  location: { lat: number; lng: number } | null;
  batch: string;
  source: string;
  intro: string;
  images: ScenicImage[];
}

export interface ScenicSearchItem {
  id: string;
  name: string;
  province: string;
  city: string;
  location: { lat: number; lng: number } | null;
}
