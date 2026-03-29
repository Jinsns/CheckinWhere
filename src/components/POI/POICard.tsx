'use client';

import { Card, Button, Tag, Rate } from 'antd';
import { PlusOutlined, CheckOutlined, EnvironmentOutlined, PhoneOutlined } from '@ant-design/icons';
import type { POI } from '@/types';
import './POICard.css';

interface POICardProps {
  poi: POI;
  onAdd?: () => void;
  onRemove?: () => void;
  onClick?: () => void;
  showAddButton?: boolean;
  isSelected?: boolean;
  compact?: boolean;
}

export default function POICard({ poi, onAdd, onRemove, onClick, showAddButton, isSelected, compact }: POICardProps) {
  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelected && onRemove) {
      onRemove();
    } else if (onAdd) {
      onAdd();
    }
  };

  return (
    <Card
      className={`poi-card ${isSelected ? 'selected' : ''} ${compact ? 'compact' : ''}`}
      hoverable
      onClick={onClick}
      size="small"
    >
      <div className="poi-card-content">
        <div className="poi-info">
          <div className="poi-name">{poi.name}</div>
          {!compact && (
            <>
              <div className="poi-address">
                <EnvironmentOutlined /> {poi.address || '暂无地址'}
              </div>
              {poi.tel && (
                <div className="poi-tel">
                  <PhoneOutlined /> {poi.tel}
                </div>
              )}
              <div className="poi-meta">
                {poi.type && <Tag color="blue">{poi.type}</Tag>}
                {poi.rating && (
                  <span className="poi-rating">
                    <Rate disabled defaultValue={poi.rating / 2} allowHalf count={5} />
                    <span className="rating-value">{poi.rating}</span>
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        {showAddButton && (
          <Button
            type={isSelected ? 'primary' : 'default'}
            icon={isSelected ? <CheckOutlined /> : <PlusOutlined />}
            onClick={handleButtonClick}
            size="small"
          >
            {isSelected ? '已选' : '添加'}
          </Button>
        )}
      </div>
    </Card>
  );
}
