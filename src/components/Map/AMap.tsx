'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { Location, POI } from '@/types';
import './AMap.css';

declare global {
  interface Window {
    AMap: any;
    _AMapSecurityConfig: {
      securityJsCode: string;
    };
  }
}

export interface NearbyPOI {
  id: string;
  name: string;
  location: Location;
}

export interface AMapRef {
  setCenter: (location: Location, zoom?: number) => void;
  addMarker: (poi: POI, type?: 'poi' | 'hotel' | 'center') => void;
  clearMarkers: () => void;
  removeMarker: (id: string) => void;
  setFitView: () => void;
  addNearbyMarkers: (category: string, icon: string, pois: NearbyPOI[]) => void;
  clearNearbyMarkers: () => void;
}

interface AMapProps {
  onMapClick?: (location: Location) => void;
  onMarkerClick?: (poi: POI) => void;
}

const AMap = forwardRef<AMapRef, AMapProps>(({ onMapClick, onMarkerClick }, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const nearbyMarkersRef = useRef<Map<string, any[]>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

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
      const jsApiKey = process.env.NEXT_PUBLIC_AMAP_JS_KEY || '';
      console.log('Loading AMap with key:', jsApiKey.slice(0, 8) + '...');

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

        console.log('AMap loaded successfully');
        setMapLoaded(true);
      }
    } catch (error) {
      console.error('Failed to load map:', error);
      setMapError(error instanceof Error ? error.message : '未知错误');
    }
  }

  function loadAMapScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.AMap) {
        resolve();
        return;
      }

      const jsApiKey = process.env.NEXT_PUBLIC_AMAP_JS_KEY || '';
      const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE || '';

      // 配置安全密钥（高德地图 2024 年之后的新要求）
      if (securityCode) {
        window._AMapSecurityConfig = {
          securityJsCode: securityCode,
        };
      }

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
        zIndex: 120,
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
    addNearbyMarkers: (category: string, icon: string, pois: NearbyPOI[]) => {
      if (!mapInstance.current) return;

      // Remove existing markers for this category
      const existing = nearbyMarkersRef.current.get(category);
      if (existing) {
        existing.forEach((m) => mapInstance.current.remove(m));
      }

      const markers = pois.map((poi) => {
        const escapedName = poi.name.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const content = `<div class="nearby-marker nearby-marker-${category}">
          <div class="nearby-icon">${icon}</div>
          <div class="nearby-name">${escapedName}</div>
        </div>`;

        const marker = new window.AMap.Marker({
          position: [poi.location.lng, poi.location.lat],
          content,
          offset: new window.AMap.Pixel(-17, -17),
          zIndex: 100,
        });

        // 悬浮时提升到最高层，确保 tooltip 不被其他标记遮挡
        marker.on('mouseover', () => marker.setTop && marker.setTop(true));
        marker.on('mouseout',  () => marker.setTop && marker.setTop(false));

        mapInstance.current.add(marker);
        return marker;
      });

      nearbyMarkersRef.current.set(category, markers);
    },
    clearNearbyMarkers: () => {
      nearbyMarkersRef.current.forEach((markers) => {
        markers.forEach((m) => mapInstance.current?.remove(m));
      });
      nearbyMarkersRef.current.clear();
    },
  }));

  return (
    <div className="amap-container">
      <div ref={mapRef} className="amap-map" />
      {mapError && (
        <div className="amap-error">
          <div className="amap-error-title">⚠️ 地图加载失败</div>
          <div className="amap-error-message">{mapError}</div>
          <div className="amap-error-hint">
            请检查：<br />
            1. 网络是否正常连接<br />
            2. 高德地图 API Key 是否配置正确<br />
            3. 浏览器控制台是否有报错
          </div>
        </div>
      )}
      {!mapLoaded && !mapError && (
        <div className="amap-loading">
          <span>🗺️ 地图加载中...</span>
        </div>
      )}
    </div>
  );
});

AMap.displayName = 'AMap';

export default AMap;
