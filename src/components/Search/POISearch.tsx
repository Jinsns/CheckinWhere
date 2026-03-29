'use client';

import { useState } from 'react';
import { Input, Button, message, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useAppContext } from '@/store/AppContext';
import POIList from '@/components/POI/POIList';
import type { POI } from '@/types';
import './POISearch.css';

interface POISearchProps {
  onPOISelect?: (poi: POI) => void;
}

export default function POISearch({ onPOISelect }: POISearchProps) {
  const { state, dispatch } = useAppContext();
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    const keyword = inputValue.trim();
    if (!keyword) {
      message.warning('请输入景点名称');
      return;
    }

    if (!state.currentCity) {
      message.warning('请先选择城市');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/amap/search-poi?keyword=${encodeURIComponent(keyword)}&city=${encodeURIComponent(state.currentCity.name)}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '搜索失败');
      }

      const data = await response.json();

      if (data.pois && data.pois.length > 0) {
        setSearchResults(data.pois);
        message.success(`找到 ${data.pois.length} 个相关景点`);
      } else {
        message.info('未找到相关景点');
        setSearchResults([]);
      }
    } catch (error: any) {
      console.error('Search POI error:', error);
      message.error(error.message || '搜索景点失败');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleAddPOI = (poi: POI) => {
    dispatch({ type: 'ADD_POI', payload: poi });
    onPOISelect?.(poi);
    message.success(`已添加「${poi.name}」到列表`);
  };

  return (
    <div className="poi-search">
      <div className="search-section">
        <div className="search-label">搜索景点</div>
        <div className="search-input-group">
          <Input
            placeholder="输入景点名称，如：故宫、长城"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={loading}
            onClick={handleSearch}
          >
            搜索
          </Button>
        </div>
      </div>

      <Spin spinning={loading}>
        {searchResults.length > 0 && (
          <div className="search-results">
            <div className="results-header">
              搜索结果 ({searchResults.length})
            </div>
            <POIList
              pois={searchResults}
              onAddPOI={handleAddPOI}
              showAddButton
            />
          </div>
        )}
      </Spin>
    </div>
  );
}
