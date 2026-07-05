'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Input, Select, Tag, Breadcrumb } from 'antd';
import {
  SearchOutlined,
  EnvironmentOutlined,
  ArrowRightOutlined,
  HomeOutlined,
  CameraOutlined,
  EnvironmentFilled,
} from '@ant-design/icons';
import allSpots from '@/data/scenic-spots/all.json';
import provinceList from '@/data/scenic-spots/province-list.json';
import type { ScenicSpot } from '@/types/scenic';
import './page.css';

const { Option } = Select;

export default function ScenicSpotsBlogList() {
  const [searchText, setSearchText] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');

  const filteredSpots = useMemo(() => {
    let spots = allSpots as ScenicSpot[];

    if (selectedProvince) {
      spots = spots.filter(s => s.province === selectedProvince);
    }

    if (searchText) {
      const search = searchText.toLowerCase();
      spots = spots.filter(s =>
        s.name.toLowerCase().includes(search) ||
        s.city.toLowerCase().includes(search)
      );
    }

    return spots;
  }, [searchText, selectedProvince]);

  const stats = useMemo(() => {
    const spots = allSpots as ScenicSpot[];
    return {
      total: spots.length,
      withLocation: spots.filter(s => s.location).length,
      withImages: spots.filter(s => s.images && s.images.length > 0).length,
      provinces: new Set(spots.map(s => s.province)).size,
    };
  }, []);

  // 提取景区简介
  const getExcerpt = (spot: ScenicSpot) => {
    if (spot.intro) {
      const lines = spot.intro.split('\n\n');
      const firstLine = lines.find(line =>
        line.length > 30 &&
        !line.startsWith('---') &&
        !line.startsWith('#') &&
        !line.startsWith('>')
      );
      return firstLine?.replace(/<[^>]+>/g, '').slice(0, 80) + '...' ||
        `${spot.name}位于${spot.province}${spot.city}，是国家AAAAA级旅游景区。`;
    }
    return `${spot.name}位于${spot.province}${spot.city}，是国家AAAAA级旅游景区。`;
  };

  return (
    <div className="blog-list-container">
      {/* 面包屑 */}
      <Breadcrumb style={{ marginBottom: 20 }} items={[
        { title: <Link href="/"><HomeOutlined /> 首页</Link> },
        { title: '5A级景区名录' },
      ]} />

      {/* 页面头部 */}
      <div className="page-header">
        <h1 className="page-title">🏛️ 中国5A级景区百科</h1>
        <p className="page-subtitle">探索全国375个顶级旅游目的地，发现最美中国</p>
        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">景区总数</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.provinces}</div>
            <div className="stat-label">覆盖省份</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.withImages}</div>
            <div className="stat-label">实景图片</div>
          </div>
        </div>
      </div>

      {/* 筛选区域 */}
      <div className="filter-section">
        <div className="filter-row">
          <Select
            placeholder="选择省份"
            value={selectedProvince || undefined}
            onChange={setSelectedProvince}
            allowClear
            className="province-select"
            size="large"
          >
            {(provinceList as string[]).map(p => (
              <Option key={p} value={p}>{p}</Option>
            ))}
          </Select>

          <Input
            placeholder="搜索景区名称..."
            prefix={<SearchOutlined />}
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="search-input"
            size="large"
          />
        </div>

        <div className="result-info">
          共找到 <Tag color="blue">{filteredSpots.length}</Tag> 个景区
          {selectedProvince && <Tag color="purple">省份: {selectedProvince}</Tag>}
          {searchText && <Tag color="green">关键词: {searchText}</Tag>}
        </div>
      </div>

      {/* 博客卡片网格 */}
      <div className="blog-grid">
        {filteredSpots.map(spot => (
          <Link
            key={spot.id}
            href={`/scenic-spots/${spot.id}`}
            style={{ display: 'block', textDecoration: 'none' }}
          >
            <div className="blog-card">
              <div className="blog-card-cover">
                {spot.images && spot.images.length > 0 ? (
                  <img
                    src={spot.images[0].url}
                    alt={spot.name}
                    className="blog-card-image"
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 50,
                  }}>
                    🏛️
                  </div>
                )}
                <div className="blog-card-tag">5A 级</div>
                <div className="blog-card-overlay">
                  <div className="blog-card-location">
                    <EnvironmentOutlined />
                    {spot.city} · {spot.province}
                  </div>
                </div>
              </div>
              <div className="blog-card-content">
                <h3 className="blog-card-title">{spot.name}</h3>
                <p className="blog-card-excerpt">{getExcerpt(spot)}</p>
                <div className="blog-card-footer">
                  <div className="blog-card-meta">
                    {spot.location && (
                      <span className="meta-tag">
                        <EnvironmentFilled />
                        已定位
                      </span>
                    )}
                    {spot.images && spot.images.length > 0 && (
                      <span className="meta-tag">
                        <CameraOutlined />
                        {spot.images.length} 图
                      </span>
                    )}
                  </div>
                  <span className="read-more">
                    阅读全文 <ArrowRightOutlined />
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
