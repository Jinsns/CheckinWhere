'use client';

import type { Hotel, POI } from '@/types';
import HotelCard from './HotelCard';
import './HotelList.css';

interface HotelListProps {
  hotels: Hotel[];
  pois: POI[];
  onHotelClick?: (hotel: Hotel) => void;
}

export default function HotelList({ hotels, pois, onHotelClick }: HotelListProps) {
  if (hotels.length === 0) {
    return <div className="hotel-list-empty">暂无酒店</div>;
  }

  return (
    <div className="hotel-list">
      <div className="hotel-list-header">
        推荐酒店 ({hotels.length})
      </div>
      {hotels.map((hotel) => (
        <HotelCard
          key={hotel.id}
          hotel={hotel}
          pois={pois}
          onClick={() => onHotelClick?.(hotel)}
        />
      ))}
    </div>
  );
}
