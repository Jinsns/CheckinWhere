'use client';

import { useRef } from 'react';
import { Layout, Badge, Button } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import AMap from '@/components/Map/AMap';
import type { AMapRef } from '@/components/Map/AMap';
import CitySearch from '@/components/Search/CitySearch';
import POISearch from '@/components/Search/POISearch';
import POIList from '@/components/POI/POIList';
import StayRecommend from '@/components/Recommendation/StayRecommend';
import { useAppContext } from '@/store/AppContext';
import type { POI, City } from '@/types';
import './page.css';

const { Content, Sider } = Layout;

export default function Home() {
  const { state, dispatch } = useAppContext();
  const mapRef = useRef<AMapRef>(null);

  const handleCityFound = (city: City) => {
    if (mapRef.current) {
      mapRef.current.setCenter(city.location, 12);
      mapRef.current.clearMarkers();
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
            <h1>旅行住宿推荐</h1>
            <p>搜索景点，智能推荐最佳住宿位置</p>
          </div>

          <div className="main-content">
            {/* 城市搜索 */}
            <CitySearch onCityFound={handleCityFound} />

            {/* 景点搜索 */}
            <div style={{ marginTop: 16 }}>
              <POISearch onPOISelect={handlePOISelect} />
            </div>

            {/* 已添加的景点 */}
            {state.pois.length > 0 && (
              <div className="selected-pois-section">
                <div className="section-header">
                  <Badge count={state.pois.length} size="small">
                    <span className="section-title">已添加景点</span>
                  </Badge>
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

            {/* 住宿推荐 */}
            <div style={{ marginTop: 16 }}>
              <StayRecommend mapRef={mapRef} />
            </div>
          </div>

          <div className="app-footer">
            <p>基于高德地图 API</p>
          </div>
        </div>
      </Sider>

      <Content className="app-content">
        <AMap ref={mapRef} onMarkerClick={handlePOIClick} />
      </Content>
    </Layout>
  );
}
