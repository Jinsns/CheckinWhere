'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { Location, POI } from '@/types';
import './AMap.css';

// 声明高德地图全局对象
declare global {
  interface Window {
    AMap: any;
    _AMapSecurityConfig: {
      securityJsCode: string;
    };
  }
}

export interface AMapRef {
  setCenter: (location: Location, zoom?: number) => void;
  addMarker: (poi: POI, type?: 'poi' | 'hotel' | 'center') => void;
  clearMarkers: () => void;
  removeMarker: (id: string) => void;
  setFitView: () => void;
}

interface AMapProps {
  onMapClick?: (location: Location) => void;
  onMarkerClick?: (poi: POI) => void;
}

const AMap = forwardRef<AMapRef, AMapProps>(({ onMapClick, onMarkerClick }, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    initMap();
    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy();
      }
    };
  }, []);

  async function initMap() {
    try {
      await loadAMapScript();
      if (mapRef.current && !mapInstance.current) {
        mapInstance.current = new window.AMap.Map(mapRef.current, {
          zoom: 5,
          center: [116.397428, 39.90923],
          viewMode: '2D',
        });

        mapInstance.current.on('click', (e: any) => {
          if (onMapClick) {
            onMapClick({ lng: e.lnglat.lng, lat: e.lnglat.lat });
          }
        });

        setMapLoaded(true);
      }
    } catch (error) {
      console.error('Failed to load map:', error);
    }
  }

  function loadAMapScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.AMap) {
        resolve();
        return;
      }

      // 使用公开的 JS API Key（仅用于地图展示，服务调用走后端）
      const jsApiKey = process.env.NEXT_PUBLIC_AMAP_JS_KEY || '';

      const script = document.createElement('script');
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${jsApiKey}&plugin=AMap.Marker`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load AMap script'));
      document.head.appendChild(script);
    });
  }

  useImperativeHandle(ref, () => ({
    setCenter: (location: Location, zoom?: number) => {
      if (mapInstance.current) {
        mapInstance.current.setZoomAndCenter(zoom || 13, [location.lng, location.lat]);
      }
    },
    addMarker: (poi: POI, type: 'poi' | 'hotel' | 'center' = 'poi') => {
      if (!mapInstance.current || markersRef.current.has(poi.id)) return;

      let markerContent = '';
      let offset = [-13, -30];

      switch (type) {
        case 'center':
          markerContent = `<div class="custom-marker center-marker">
            <div class="marker-icon">🏠</div>
          </div>`;
          offset = [-15, -35];
          break;
        case 'hotel':
          markerContent = `<div class="custom-marker hotel-marker">
            <div class="marker-icon">🏨</div>
            <div class="marker-label">${poi.name}</div>
          </div>`;
          offset = [-13, -35];
          break;
        default:
          markerContent = `<div class="custom-marker poi-marker">
            <div class="marker-icon">📍</div>
            <div class="marker-label">${poi.name}</div>
          </div>`;
      }

      const marker = new window.AMap.Marker({
        position: [poi.location.lng, poi.location.lat],
        content: markerContent,
        offset: new window.AMap.Pixel(offset[0], offset[1]),
      });

      marker.on('click', () => {
        if (onMarkerClick) {
          onMarkerClick(poi);
        }
      });

      mapInstance.current.add(marker);
      markersRef.current.set(poi.id, marker);
    },
    clearMarkers: () => {
      markersRef.current.forEach((marker) => {
        mapInstance.current.remove(marker);
      });
      markersRef.current.clear();
    },
    removeMarker: (id: string) => {
      const marker = markersRef.current.get(id);
      if (marker && mapInstance.current) {
        mapInstance.current.remove(marker);
        markersRef.current.delete(id);
      }
    },
    setFitView: () => {
      if (mapInstance.current && markersRef.current.size > 0) {
        mapInstance.current.setFitView(Array.from(markersRef.current.values()));
      }
    },
  }));

  return (
    <div className="amap-container">
      <div ref={mapRef} className="amap-map" />
      {!mapLoaded && (
        <div className="amap-loading">
          <span>地图加载中...</span>
        </div>
      )}
    </div>
  );
});

AMap.displayName = 'AMap';

export default AMap;
