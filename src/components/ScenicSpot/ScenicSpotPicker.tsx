'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Select, Input, Card, Tag, Badge, Empty, Tooltip } from 'antd';
import { SearchOutlined, EnvironmentOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';
import scenicIndex from '@/data/scenic-spots/search-index.json';
import provinceList from '@/data/scenic-spots/province-list.json';
import cityList from '@/data/scenic-spots/city-list.json';
import type { ScenicSearchItem } from '@/types/scenic';

const { Option } = Select;
const { Search } = Input;

interface ScenicSpotPickerProps {
  onSpotSelect: (spot: ScenicSearchItem) => void;
  selectedIds?: string[];
}

export default function ScenicSpotPicker({ onSpotSelect, selectedIds = [] }: ScenicSpotPickerProps) {
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');

  // Get available cities for selected province
  const availableCities = useMemo(() => {
    if (!selectedProvince) return [];
    return (cityList as Record<string, string[]>)[selectedProvince] || [];
  }, [selectedProvince]);

  // Filter spots based on selection and search
  const filteredSpots = useMemo(() => {
    let spots = scenicIndex as ScenicSearchItem[];

    if (selectedProvince) {
      spots = spots.filter(s => s.province === selectedProvince);
    }
    if (selectedCity) {
      spots = spots.filter(s => s.city === selectedCity);
    }
    if (searchText) {
      const search = searchText.toLowerCase();
      spots = spots.filter(s =>
        s.name.toLowerCase().includes(search) ||
        s.city.toLowerCase().includes(search)
      );
    }

    return spots;
  }, [selectedProvince, selectedCity, searchText]);

  const handleProvinceChange = (value: string) => {
    setSelectedProvince(value);
    setSelectedCity('');
  };

  const handleSpotClick = (spot: ScenicSearchItem) => {
    onSpotSelect(spot);
  };

  const isSelected = (spotId: string) => selectedIds.includes(spotId);

  return (
    <div className="scenic-picker">
      <div className="scenic-picker-filters">
        <Select
          placeholder="选择省份"
          value={selectedProvince || undefined}
          onChange={handleProvinceChange}
          allowClear
          style={{ width: '50%' }}
          size="large"
        >
          {(provinceList as string[]).map(province => (
            <Option key={province} value={province}>
              {province}
            </Option>
          ))}
        </Select>

        <Select
          placeholder="选择城市"
          value={selectedCity || undefined}
          onChange={setSelectedCity}
          allowClear
          style={{ width: '50%' }}
          size="large"
          disabled={!selectedProvince}
        >
          {availableCities.map(city => (
            <Option key={city} value={city}>
              {city}
            </Option>
          ))}
        </Select>
      </div>

      <Search
        placeholder="搜索景区名称..."
        prefix={<SearchOutlined />}
        allowClear
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ marginBottom: 16 }}
        size="large"
      />

      <div className="scenic-spot-grid">
        {filteredSpots.length === 0 ? (
          <Empty
            description="暂无匹配的景区"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          filteredSpots.map(spot => (
            <Card
              key={spot.id}
              size="small"
              className={`scenic-spot-card ${isSelected(spot.id) ? 'selected' : ''}`}
              hoverable
            >
              <div
                className="spot-card-content"
                onClick={() => !isSelected(spot.id) && handleSpotClick(spot)}
              >
                <div className="spot-name">
                  {isSelected(spot.id) ? (
                    <Badge status="success" text={spot.name} />
                  ) : (
                    <span>{spot.name}</span>
                  )}
                </div>
                <div className="spot-location">
                  <EnvironmentOutlined />
                  <span>{spot.city} · {spot.province}</span>
                </div>
                <div className="spot-tags">
                  <Tag color="gold" icon={<span>🏛️</span>}>5A</Tag>
                  {spot.location && (
                    <Tag color="green">已定位</Tag>
                  )}
                  {!isSelected(spot.id) && (
                    <PlusOutlined className="add-icon" />
                  )}
                </div>
              </div>
              <div className="spot-card-footer">
                <Tooltip title="查看详情">
                  <Link
                    href={`/scenic-spots/${spot.id}`}
                    target="_blank"
                    onClick={(e) => e.stopPropagation()}
                    className="detail-link"
                  >
                    <EyeOutlined /> 详情
                  </Link>
                </Tooltip>
              </div>
            </Card>
          ))
        )}
      </div>

      <style jsx>{`
        .scenic-picker {
          width: 100%;
        }

        .scenic-picker-filters {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .scenic-spot-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          max-height: 300px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .scenic-spot-card {
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 8px;
        }

        .scenic-spot-card:hover {
          border-color: #1890ff;
          box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
        }

        .scenic-spot-card.selected {
          border-color: #52c41a;
          background: #f6ffed;
        }

        .spot-card-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .spot-name {
          font-weight: 500;
          font-size: 14px;
          color: #262626;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .spot-location {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #8c8c8c;
        }

        .spot-tags {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
        }

        .add-icon {
          margin-left: auto;
          color: #1890ff;
          font-size: 14px;
        }

        .spot-card-footer {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #f0f0f0;
          text-align: right;
        }

        .detail-link {
          font-size: 12px;
          color: #1890ff;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .detail-link:hover {
          color: #40a9ff;
        }

        .scenic-spot-grid::-webkit-scrollbar {
          width: 6px;
        }

        .scenic-spot-grid::-webkit-scrollbar-thumb {
          background: #d9d9d9;
          border-radius: 3px;
        }

        .scenic-spot-grid::-webkit-scrollbar-track {
          background: #f5f5f5;
        }
      `}</style>
    </div>
  );
}
