'use client';

import { useState } from 'react';
import { Input, Button, message, Alert } from 'antd';
import { SearchOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useAppContext } from '@/store/AppContext';
import type { City } from '@/types';
import './CitySearch.css';

interface CitySearchProps {
  onCityFound?: (city: City) => void;
}

export default function CitySearch({ onCityFound }: CitySearchProps) {
  const { state, dispatch } = useAppContext();
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const cityName = inputValue.trim();
    if (!cityName) {
      message.warning('请输入城市名称');
      return;
    }

    setLoading(true);
    setError(null);
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response = await fetch(`/api/amap/geocode?city=${encodeURIComponent(cityName)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '搜索失败');
      }

      const city: City = await response.json();

      dispatch({ type: 'SET_CITY', payload: city });
      dispatch({ type: 'SET_MAP_CENTER', payload: city.location });
      dispatch({ type: 'SET_MAP_ZOOM', payload: 12 });
      dispatch({ type: 'CLEAR_POIS' });
      message.success(`已定位到 ${city.name}`);
      onCityFound?.(city);
    } catch (error: any) {
      console.error('Search city error:', error);
      setError(error.message || '搜索城市失败，请稍后重试');
      message.error(error.message || '搜索城市失败');
    } finally {
      setLoading(false);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="city-search">
      <div className="search-header">
        <EnvironmentOutlined className="search-icon" />
        <span>选择城市</span>
      </div>
      <div className="search-input-group">
        <Input
          placeholder="输入城市名称，如：北京、上海"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          size="large"
          allowClear
        />
        <Button
          type="primary"
          icon={<SearchOutlined />}
          loading={loading}
          onClick={handleSearch}
          size="large"
        >
          搜索
        </Button>
      </div>
      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginTop: 12 }}
        />
      )}
      {state.currentCity && (
        <div className="current-city">
          当前城市：<strong>{state.currentCity.name}</strong>
        </div>
      )}
    </div>
  );
}
