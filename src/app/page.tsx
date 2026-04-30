'use client';

import { useRef, useState } from 'react';
import { Layout, Badge } from 'antd';
import AMap from '@/components/Map/AMap';
import type { AMapRef, NearbyPOI } from '@/components/Map/AMap';
import LocationAnnounce from '@/components/Map/LocationAnnounce';
import CitySearch from '@/components/Search/CitySearch';
import POISearch from '@/components/Search/POISearch';
import POIList from '@/components/POI/POIList';
import StayRecommend from '@/components/Recommendation/StayRecommend';
import RandomPicker from '@/components/Random/RandomPicker';
import { useAppContext } from '@/store/AppContext';
import type { POI, City } from '@/types';
import './page.css';

const { Content, Sider } = Layout;

export default function Home() {
  const { state, dispatch } = useAppContext();
  const mapRef = useRef<AMapRef>(null);
  const [locationName, setLocationName] = useState<string | null>(null);

  const handleCityFound = async (city: City) => {
    if (mapRef.current) {
      mapRef.current.setCenter(city.location, 12);
      mapRef.current.clearMarkers();
      mapRef.current.clearNearbyMarkers();
    }
    setLocationName(city.name);

    // Fetch nearby POIs for the 4 categories（按行政区均匀分布）
    try {
      const res = await fetch(
        `/api/amap/nearby?lat=${city.location.lat}&lng=${city.location.lng}&adcode=${city.adcode}`
      );
      const data = await res.json();
      if (data.categories && mapRef.current) {
        for (const cat of data.categories) {
          if ((cat.pois as NearbyPOI[]).length > 0) {
            mapRef.current.addNearbyMarkers(cat.key, cat.icon, cat.pois);
          }
        }
      }
    } catch {
      // Nearby markers are non-critical; ignore errors
    }
  };

  const handlePOISelect = (poi: POI) => {
    dispatch({ type: 'ADD_POI', payload: poi });
    if (mapRef.current) {
      mapRef.current.addMarker(poi, 'poi');
    }
  };

  const handlePOIClick = (poi: POI) => {
    if (mapRef.current) {
      mapRef.current.setCenter(poi.location, 16);
    }
  };

  return (
    <Layout className="app-layout">
      <Sider width={400} className="app-sider" breakpoint="lg" collapsedWidth={0}>
        <div className="sider-content">

          <div className="app-header">
            <div className="header-logo">📍</div>
            <div className="header-text">
              <h1>住哪儿</h1>
              <p>智能推荐旅行中转最优住宿</p>
            </div>
          </div>

          <div className="main-content">

            <div className="section-card">
              <div className="section-label">选择城市</div>
              <CitySearch onCityFound={handleCityFound} />
            </div>

            <div className="section-card">
              <RandomPicker onCityFound={handleCityFound} />
            </div>

            <div className="section-card">
              <div className="section-label">添加景点</div>
              <POISearch onPOISelect={handlePOISelect} />
            </div>

            {state.pois.length > 0 && (
              <div className="section-card poi-section">
                <div className="poi-section-header">
                  <div className="section-label">
                    已添加景点
                    <Badge count={state.pois.length} size="small" style={{ marginLeft: 6, background: '#E1306C' }} />
                  </div>
                  <a
                    className="clear-link"
                    onClick={() => {
                      dispatch({ type: 'CLEAR_POIS' });
                      mapRef.current?.clearMarkers();
                    }}
                  >
                    清空
                  </a>
                </div>
                <POIList
                  pois={state.pois}
                  onPOIClick={handlePOIClick}
                  onRemovePOI={(id) => {
                    dispatch({ type: 'DESELECT_POI', payload: id });
                    mapRef.current?.removeMarker(id);
                  }}
                  selectedIds={state.selectedPois.map((p) => p.id)}
                  compact
                />
              </div>
            )}

            <div className="section-card">
              <StayRecommend mapRef={mapRef} />
            </div>

          </div>

          <div className="app-footer">
            <p>Powered by 高德地图 · checkinwhere.site</p>
          </div>
        </div>
      </Sider>

      <Content className="app-content">
        <AMap ref={mapRef} onMarkerClick={handlePOIClick} />
        <LocationAnnounce locationName={locationName} />
      </Content>
    </Layout>
  );
}
