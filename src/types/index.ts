// 高德地图相关类型定义

export interface Location {
  lng: number;
  lat: number;
}

export interface POI {
  id: string;
  name: string;
  address: string;
  location: Location;
  type: string;
  typecode?: string;
  tel?: string;
  rating?: number;
  cost?: number;
  photos?: string[];
  selected?: boolean;
}

export interface Hotel extends POI {
  price?: number;
  star?: string;
  // 推荐相关字段
  nearPoiId?: string;
  nearPoiName?: string;
  distanceToPoi?: number;
  nearestStop?: {
    name: string;
    type: string;
    distance: number;
  };
  routesToPois?: Array<{
    poiId: string;
    poiName: string;
    duration: number;
    distance: number;
    walkingDistance: number;
  }>;
}

export interface City {
  name: string;
  adcode: string;
  location: Location;
  level: string;
}

export interface PoiRoute {
  from: string;
  to: string;
  fromName: string;
  toName: string;
  duration: number;
  distance: number;
  walkingDistance: number;
}

export interface StayRecommendation {
  poiRoutes: PoiRoute[];
  hotels: Hotel[];
  totalFound: number;
}

export interface AppState {
  currentCity: City | null;
  pois: POI[];
  selectedPois: POI[];
  hotels: Hotel[];
  recommendation: StayRecommendation | null;
  mapCenter: Location | null;
  mapZoom: number;
  loading: boolean;
  error: string | null;
}

export type AppAction =
  | { type: 'SET_CITY'; payload: City }
  | { type: 'SET_POIS'; payload: POI[] }
  | { type: 'ADD_POI'; payload: POI }
  | { type: 'SELECT_POI'; payload: string }
  | { type: 'DESELECT_POI'; payload: string }
  | { type: 'CLEAR_POIS' }
  | { type: 'SET_HOTELS'; payload: Hotel[] }
  | { type: 'SET_RECOMMENDATION'; payload: StayRecommendation | null }
  | { type: 'SET_MAP_CENTER'; payload: Location }
  | { type: 'SET_MAP_ZOOM'; payload: number }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };
