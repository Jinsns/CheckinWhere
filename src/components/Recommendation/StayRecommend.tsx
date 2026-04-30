'use client';

import { useState, useMemo } from 'react';
import { Button, message, Card, Spin, Divider, Tag, Slider, InputNumber, Space } from 'antd';
import { HomeOutlined, ClockCircleOutlined, CarOutlined, SwapOutlined, FilterOutlined, AimOutlined, SubnodeOutlined } from '@ant-design/icons';
import { useAppContext } from '@/store/AppContext';
import type { POI, PoiRoute } from '@/types';
import './StayRecommend.css';

interface Accommodation {
  id: string;
  name: string;
  address: string;
  location: { lng: number; lat: number };
  type: string;
  tel?: string;
  rating?: number;
  price?: number;
  distance?: number;
  nearStation?: { name: string; type: string; distance: number; isTransfer?: boolean };
  routesToPois: Array<{
    poiId: string;
    poiName: string;
    duration: number;
    distance: number;
    walkingDistance: number;
  }>;
  durationsMap: Record<string, number>;
  avgDuration: number;
  balance: number;
}

interface RecommendResult {
  poiRoutes: PoiRoute[];
  accommodations: Accommodation[];
  totalFound: number;
  searchedStations: Array<{ name: string; type: string; isTransfer?: boolean }>;
}

interface StayRecommendProps {
  mapRef?: React.RefObject<any>;
}

export default function StayRecommend({ mapRef }: StayRecommendProps) {
  const { state } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [priceRange, setPriceRange] = useState<[number, number]>([200, 500]);

  const pois = state.pois;

  const handleRecommend = async () => {
    if (pois.length < 1) {
      message.warning('请至少添加1个景点');
      return;
    }
    if (!state.currentCity) {
      message.warning('请先选择城市');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/amap/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pois, city: state.currentCity.name }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '推荐失败');
      }

      const data: RecommendResult = await response.json();
      setResult(data);

      // 地图标记
      if (mapRef?.current) {
        mapRef.current.clearMarkers();
        pois.forEach((poi) => mapRef.current.addMarker(poi, 'poi'));
        data.accommodations.slice(0, 5).forEach((acc) => {
          mapRef.current.addMarker(acc as any, 'hotel');
        });
        // 以最优推荐住宿为中心展示地图
        if (data.accommodations.length > 0) {
          mapRef.current.setCenter(data.accommodations[0].location, 14);
        }
      }

      message.success(`找到 ${data.totalFound} 家住宿`);
    } catch (error: any) {
      console.error('Recommend error:', error);
      message.error(error.message || '推荐失败');
    } finally {
      setLoading(false);
    }
  };

  // 价格筛选
  const filteredAccommodations = useMemo(() => {
    if (!result) return [];
    return result.accommodations.filter((acc) => {
      // 没有有效价格信息的保留
      if (!acc.price || isNaN(acc.price)) return true;
      return acc.price >= priceRange[0] && acc.price <= priceRange[1];
    });
  }, [result, priceRange]);

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '-';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}分钟`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m}min` : `${h}h`;
  };

  const formatDistance = (meters: number): string => {
    if (!meters) return '-';
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  return (
    <div className="stay-recommend">
      <div className="recommend-header">
        <h3><HomeOutlined /> 住宿推荐</h3>
        <p>已添加 {pois.length} 个景点</p>
      </div>

      {pois.length < 1 ? (
        <div className="empty-tip">
          <p className="tip-title">请先添加景点</p>
          <p className="tip-desc">搜索并添加景点后，推荐沿线的住宿</p>
        </div>
      ) : (
        <Button type="primary" size="large" icon={<HomeOutlined />} loading={loading} onClick={handleRecommend} block>
          为我推荐住宿
        </Button>
      )}

      <Spin spinning={loading}>
        {result && (
          <div className="recommend-result">

            {/* 景点间路线 */}
            {result.poiRoutes?.length > 0 && (
              <Card className="poi-routes-card" size="small" title={<span><SwapOutlined /> 景点间公交路线</span>}>
                {result.poiRoutes.map((route, i) => (
                  <div key={i} className="poi-route-item">
                    <div className="route-header">
                      <Tag color="blue">{route.fromName}</Tag>
                      <span className="route-arrow">→</span>
                      <Tag color="green">{route.toName}</Tag>
                    </div>
                    <div className="route-info">
                      <span><ClockCircleOutlined /> {formatDuration(route.duration)}</span>
                      <span><CarOutlined /> {formatDistance(route.distance)}</span>
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {/* 搜索的中间站点 */}
            {result.searchedStations?.length > 0 && (
              <div className="stations-info">
                <span className="stations-label"><SubnodeOutlined /> 搜索沿线站点：</span>
                <div className="stations-tags">
                  {result.searchedStations.map((s, i) => (
                    <Tag key={i}
                      color={s.isTransfer ? 'volcano' : s.type === 'subway' ? 'blue' : 'green'}
                    >
                      {s.isTransfer ? '换乘' : s.type === 'subway' ? '地铁' : '公交'}：{s.name}
                    </Tag>
                  ))}
                </div>
              </div>
            )}

            {/* 价格筛选 */}
            <Card className="filter-card" size="small" title={<span><FilterOutlined /> 价格筛选</span>}>
              <div className="price-filter">
                <InputNumber
                  min={0} max={9999} step={50}
                  value={priceRange[0]}
                  onChange={(v) => setPriceRange([v ?? priceRange[0], priceRange[1]])}
                  prefix="¥"
                  style={{ width: 100 }}
                />
                <span className="price-sep">~</span>
                <InputNumber
                  min={0} max={9999} step={50}
                  value={priceRange[1]}
                  onChange={(v) => setPriceRange([priceRange[0], v ?? priceRange[1]])}
                  prefix="¥"
                  style={{ width: 100 }}
                />
                <span className="filter-count">共 {filteredAccommodations.length} 家</span>
              </div>
            </Card>

            <Divider>住宿推荐（按到各景点时间均衡度排序）</Divider>

            {/* 住宿列表 */}
            {filteredAccommodations.map((acc) => (
              <Card key={acc.id} className="acc-card" size="small" hoverable
                onClick={() => mapRef?.current?.setCenter(acc.location, 16)}
              >
                <div className="acc-main">
                  <div className="acc-name">{acc.name}</div>
                  <div className="acc-meta-row">
                    {acc.price && <span className="acc-price">¥{acc.price}/晚</span>}
                    {acc.rating && <span className="acc-rating-val">★ {acc.rating}</span>}
                    {acc.tel && <span className="acc-tel">{acc.tel}</span>}
                  </div>
                  <div className="acc-address"><AimOutlined /> {acc.address}</div>
                </div>

                {acc.nearStation && (
                  <div className="acc-near-station">
                    <Tag color={acc.nearStation.isTransfer ? 'volcano' : acc.nearStation.type === 'subway' ? 'blue' : 'green'}>
                      {acc.nearStation.isTransfer ? '换乘站' : acc.nearStation.type === 'subway' ? '地铁' : '公交'}
                    </Tag>
                    <span>{acc.nearStation.name}</span>
                    <span className="station-dist">步行 {formatDistance(acc.nearStation.distance)}</span>
                  </div>
                )}

                <div className="acc-routes">
                  <div className="acc-routes-title">到各景点路线</div>
                  {acc.routesToPois.map((route) => (
                    <div key={route.poiId} className="acc-route-row">
                      <span className="route-target">{route.poiName}</span>
                      <div className="route-detail">
                        <span className="route-time"><ClockCircleOutlined /> {formatDuration(route.duration)}</span>
                        {route.walkingDistance > 0 && route.walkingDistance < route.distance && (
                          <span className="route-walk">步行 {formatDistance(route.walkingDistance)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="acc-balance">
                    均衡度：{acc.balance < 5 ? '极佳' : acc.balance < 15 ? '良好' : '一般'}
                    <span className="avg-time"> · 平均 {Math.round(acc.avgDuration)}分钟</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Spin>
    </div>
  );
}
