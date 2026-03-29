'use client';

import type { POI } from '@/types';
import POICard from './POICard';
import './POIList.css';

interface POIListProps {
  pois: POI[];
  onAddPOI?: (poi: POI) => void;
  onRemovePOI?: (poiId: string) => void;
  onPOIClick?: (poi: POI) => void;
  showAddButton?: boolean;
  selectedIds?: string[];
  compact?: boolean;
}

export default function POIList({
  pois,
  onAddPOI,
  onRemovePOI,
  onPOIClick,
  showAddButton,
  selectedIds = [],
  compact,
}: POIListProps) {
  if (pois.length === 0) {
    return <div className="poi-list-empty">暂无景点</div>;
  }

  return (
    <div className="poi-list">
      {pois.map((poi) => (
        <POICard
          key={poi.id}
          poi={poi}
          onAdd={() => onAddPOI?.(poi)}
          onRemove={() => onRemovePOI?.(poi.id)}
          onClick={() => onPOIClick?.(poi)}
          showAddButton={showAddButton}
          isSelected={selectedIds.includes(poi.id)}
          compact={compact}
        />
      ))}
    </div>
  );
}
