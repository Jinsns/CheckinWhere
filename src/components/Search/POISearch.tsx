'use client';

import { useState, useEffect, useRef } from 'react';
import { Input, Button, Spin } from 'antd';
import { SearchOutlined, FireOutlined, PlusOutlined } from '@ant-design/icons';
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

  // 热门景点
  const [hotPOIs, setHotPOIs] = useState<POI[]>([]);
  const [hotLoading, setHotLoading] = useState(false);
  const [showHot, setShowHot] = useState(false);
  const hotCityRef = useRef<string>(''); // 记录上次请求的城市，避免重复拉取
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 城市切换时清空缓存
  useEffect(() => {
    if (state.currentCity?.name !== hotCityRef.current) {
      setHotPOIs([]);
      hotCityRef.current = '';
    }
  }, [state.currentCity?.name]);

  const fetchHotPOIs = async (cityName: string) => {
    if (hotCityRef.current === cityName && hotPOIs.length > 0) return; // 命中缓存
    setHotLoading(true);
    try {
      const res = await fetch(`/api/amap/hot-pois?city=${encodeURIComponent(cityName)}`);
      const data = await res.json();
      if (data.pois) {
        setHotPOIs(data.pois);
        hotCityRef.current = cityName;
      }
    } catch { /* 热门景点失败不阻断流程 */ }
    finally { setHotLoading(false); }
  };

  const handleFocus = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    if (!inputValue && state.currentCity) {
      fetchHotPOIs(state.currentCity.name);
      setShowHot(true);
    }
  };

  const handleBlur = () => {
    // 延迟关闭，让点击事件先触发
    blurTimerRef.current = setTimeout(() => setShowHot(false), 200);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (!val) {
      setShowHot(!!state.currentCity);
    } else {
      setShowHot(false);
    }
  };

  const handleSearch = async () => {
    const keyword = inputValue.trim();
    if (!keyword) return;
    if (!state.currentCity) return;

    setShowHot(false);
    setLoading(true);
    try {
      const response = await fetch(
        `/api/amap/search-poi?keyword=${encodeURIComponent(keyword)}&city=${encodeURIComponent(state.currentCity.name)}`
      );
      if (!response.ok) throw new Error((await response.json()).error || '搜索失败');
      const data = await response.json();
      setSearchResults(data.pois ?? []);
    } catch (error: any) {
      console.error('Search POI error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleAddPOI = (poi: POI) => {
    dispatch({ type: 'ADD_POI', payload: poi });
    onPOISelect?.(poi);
    setShowHot(false);
  };

  const isHotVisible = showHot && !inputValue && (hotLoading || hotPOIs.length > 0);

  return (
    <div className="poi-search">
      <div className="search-input-group" style={{ position: 'relative' }}>
        <Input
          placeholder={state.currentCity ? `在${state.currentCity.name}搜索景点` : '请先选择城市'}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
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

        {/* 热门景点下拉 */}
        {isHotVisible && (
          <div className="hot-dropdown">
            <div className="hot-dropdown-header">
              <FireOutlined style={{ color: 'var(--ig-red)' }} />
              <span>{state.currentCity?.name}热门景点</span>
            </div>
            {hotLoading ? (
              <div className="hot-dropdown-loading"><Spin size="small" /></div>
            ) : (
              <div className="hot-dropdown-list">
                {hotPOIs.map((poi) => (
                  <div
                    key={poi.id}
                    className="hot-dropdown-item"
                    onMouseDown={(e) => e.preventDefault()} // 防止 blur 先触发
                    onClick={() => handleAddPOI(poi)}
                  >
                    <div className="hot-item-info">
                      <span className="hot-item-name">{poi.name}</span>
                      {poi.rating && (
                        <span className="hot-item-rating">★ {poi.rating}</span>
                      )}
                    </div>
                    <PlusOutlined className="hot-item-add" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Spin spinning={loading}>
        {searchResults.length > 0 && !showHot && (
          <div className="search-results">
            <div className="results-header">搜索结果 ({searchResults.length})</div>
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
