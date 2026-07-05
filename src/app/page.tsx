'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { Layout, Badge, Collapse } from 'antd';
import AMap from '@/components/Map/AMap';
import type { AMapRef, NearbyPOI } from '@/components/Map/AMap';
import LocationAnnounce from '@/components/Map/LocationAnnounce';
import CitySearch from '@/components/Search/CitySearch';
import POISearch from '@/components/Search/POISearch';
import POIList from '@/components/POI/POIList';
import StayRecommend from '@/components/Recommendation/StayRecommend';
import RandomPicker from '@/components/Random/RandomPicker';
import ScenicSpotPicker from '@/components/ScenicSpot/ScenicSpotPicker';
import { useAppContext } from '@/store/AppContext';
import { scenicSearchItemToPOI } from '@/lib/scenic-to-poi';
import type { POI, City } from '@/types';
import type { ScenicSearchItem } from '@/types/scenic';
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

    // Fetch scenic attractions within the city-level administrative region
    try {
      const res = await fetch(
        `/api/amap/nearby?city=${encodeURIComponent(city.name)}&adcode=${city.adcode}`
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

  // Check for pending scenic spot from detail page
  useEffect(() => {
    const pending = localStorage.getItem('pendingScenicSpot');
    if (pending) {
      try {
        const spot = JSON.parse(pending) as ScenicSearchItem;
        const poi = scenicSearchItemToPOI(spot);
        dispatch({ type: 'ADD_POI', payload: poi });
        if (mapRef.current && poi.location.lat !== 0) {
          mapRef.current.addMarker(poi, 'poi');
        }
      } catch (e) {
        console.error('Failed to parse pending scenic spot');
      }
      localStorage.removeItem('pendingScenicSpot');
    }
  }, [dispatch]);

  const handleScenicSpotSelect = (spot: ScenicSearchItem) => {
    const poi = scenicSearchItemToPOI(spot);
    dispatch({ type: 'ADD_POI', payload: poi });
    if (mapRef.current && poi.location.lat !== 0) {
      mapRef.current.addMarker(poi, 'poi');
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

            <section className="section-card seo-intro" aria-label="CheckinWhere 旅行住宿推荐工具介绍">
              <div className="seo-kicker">CheckinWhere · 住哪儿</div>
              <h2>多景点旅行，住哪里更方便？</h2>
              <p>
                CheckinWhere 是一个旅行住宿位置推荐工具。添加多个景点后，系统会根据公交和地铁通勤时间，
                推荐更适合作为城市旅行中转点的住宿区域，适合自由行、周末游和多景点行程规划。
              </p>
              <div className="seo-tags" aria-label="核心功能">
                <span>多景点住宿推荐</span>
                <span>公共交通优先</span>
                <span>城市旅行规划</span>
              </div>
            </section>

            <div className="section-card">
              <div className="section-label">选择城市</div>
              <CitySearch onCityFound={handleCityFound} />
            </div>

            <div className="section-card">
              <RandomPicker onCityFound={handleCityFound} />
            </div>

            <Collapse
              defaultActiveKey={['search']}
              className="scenic-collapse"
              items={[
                {
                  key: 'search',
                  label: (
                    <div className="collapse-label">
                      <span className="collapse-icon">🔍</span>
                      <span>搜索景点</span>
                    </div>
                  ),
                  children: (
                    <POISearch onPOISelect={handlePOISelect} />
                  ),
                },
                {
                  key: '5a',
                  label: (
                    <div className="collapse-label">
                      <span className="collapse-icon">🏛️</span>
                      <span>5A级景区</span>
                      <Badge count={374} size="small" style={{ marginLeft: 8 }} />
                    </div>
                  ),
                  children: (
                    <div>
                      <ScenicSpotPicker
                        onSpotSelect={handleScenicSpotSelect}
                        selectedIds={state.pois.map(p => p.id.replace('scenic-', ''))}
                      />
                      <div style={{ textAlign: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                        <Link href="/scenic-spots" style={{ fontSize: 13, color: '#1890ff' }}>
                          查看全部 374 个景区名录 →
                        </Link>
                      </div>
                    </div>
                  ),
                },
              ]}
            />

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
            <p className="footer-icp">
              <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
                京ICP备2026020953号-1
              </a>
            </p>
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
