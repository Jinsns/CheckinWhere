'use client';

import { Card, Tag, Rate, Divider } from 'antd';
import { EnvironmentOutlined, PhoneOutlined, DollarOutlined, ClockCircleOutlined, CarOutlined, AimOutlined } from '@ant-design/icons';
import type { Hotel, POI } from '@/types';
import './HotelCard.css';

interface HotelCardProps {
  hotel: Hotel;
  pois: POI[];
  onClick?: () => void;
}

export default function HotelCard({ hotel, pois, onClick }: HotelCardProps) {
  const formatDuration = (seconds: number): string => {
    if (!seconds) return '-';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  const formatDistance = (meters: number): string => {
    if (!meters) return '-';
    if (meters < 1000) return `${Math.round(meters)}米`;
    return `${(meters / 1000).toFixed(1)}公里`;
  };

  return (
    <Card className="hotel-card" hoverable onClick={onClick} size="small">
      <div className="hotel-content">
        {/* 酒店基本信息 */}
        <div className="hotel-main">
          <div className="hotel-name">{hotel.name}</div>
          <div className="hotel-address">
            <EnvironmentOutlined /> {hotel.address || '暂无地址'}
          </div>
          {hotel.tel && (
            <div className="hotel-tel">
              <PhoneOutlined /> {hotel.tel}
            </div>
          )}
          <div className="hotel-meta">
            {hotel.type && <Tag color="orange">{hotel.type}</Tag>}
            {hotel.rating && (
              <span className="hotel-rating">
                <Rate disabled defaultValue={hotel.rating / 2} allowHalf count={5} />
                <span className="rating-value">{hotel.rating}</span>
              </span>
            )}
            {hotel.price && (
              <span className="hotel-price">
                <DollarOutlined /> ¥{hotel.price}起/晚
              </span>
            )}
          </div>
        </div>

        {/* 位置信息 */}
        <div className="hotel-location-info">
          {hotel.nearPoiName && (
            <div className="near-poi">
              <AimOutlined /> 距离 <strong>{hotel.nearPoiName}</strong> {formatDistance(hotel.distanceToPoi || 0)}
            </div>
          )}
          {hotel.nearestStop && (
            <div className="nearest-stop">
              <Tag color={hotel.nearestStop.type === 'subway' ? 'blue' : 'green'}>
                {hotel.nearestStop.type === 'subway' ? '地铁' : '公交'}
              </Tag>
              <span className="stop-name">{hotel.nearestStop.name}</span>
              <span className="stop-distance">步行 {formatDistance(hotel.nearestStop.distance)}</span>
            </div>
          )}
        </div>

        {/* 到各景点的路线 */}
        {hotel.routesToPois && hotel.routesToPois.length > 0 && (
          <div className="hotel-routes">
            <div className="routes-title">
              <CarOutlined /> 到各景点路线
            </div>
            <div className="routes-list">
              {hotel.routesToPois.map((route) => (
                <div key={route.poiId} className="route-row">
                  <span className="target-poi">{route.poiName}</span>
                  <div className="route-details">
                    <span className="route-duration">
                      <ClockCircleOutlined /> {formatDuration(route.duration)}
                    </span>
                    <span className="route-distance">
                      {formatDistance(route.distance)}
                    </span>
                    {route.walkingDistance > 0 && (
                      <span className="walking-distance">
                        步行 {formatDistance(route.walkingDistance)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
