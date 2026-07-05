'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Tag, Breadcrumb, Spin, Empty } from 'antd';
import {
  ArrowLeftOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  CameraOutlined,
  PlusOutlined,
  HomeOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import allSpots from '@/data/scenic-spots/all.json';
import MarkdownRenderer from '@/components/ScenicSpot/MarkdownRenderer';
import '@/components/ScenicSpot/MarkdownRenderer.css';
import type { ScenicSpot } from '@/types/scenic';
import './page.css';

interface ScenicContent {
  frontmatter: Record<string, any>;
  body: string;
  path: string;
}

export default function ScenicSpotBlog() {
  const params = useParams();
  const router = useRouter();
  const spotId = decodeURIComponent(params.id as string);
  const [content, setContent] = useState<ScenicContent | null>(null);
  const [loading, setLoading] = useState(true);

  const spot = useMemo(() => {
    return (allSpots as ScenicSpot[]).find(s => s.id === spotId);
  }, [spotId]);

  useEffect(() => {
    async function fetchContent() {
      if (!spot) {
        setLoading(false);
        return;
      }

      try {
        // Construct path from spot metadata
        const spotPath = encodeURIComponent(`${spot.province}/${spot.city}/${spot.name}`);
        const response = await fetch(`/api/scenic-content?path=${spotPath}`);

        if (response.ok) {
          const data = await response.json();
          setContent(data);
        } else {
          // Fallback: use intro from JSON
          console.log('Using fallback content from JSON');
        }
      } catch (error) {
        console.error('Failed to fetch scenic content:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchContent();
  }, [spot]);

  const handleAddToItinerary = () => {
    if (spot) {
      localStorage.setItem('pendingScenicSpot', JSON.stringify(spot));
      router.push('/');
    }
  };

  if (loading) {
    return (
      <div className="blog-loading">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!spot) {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center' }}>
        <Empty description="未找到该景区" />
        <Button
          type="primary"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/scenic-spots')}
          style={{ marginTop: 20 }}
        >
          返回景区列表
        </Button>
      </div>
    );
  }

  const heroImage = spot.images && spot.images.length > 0
    ? spot.images[0].url
    : 'https://picsum.photos/1200/600';

  return (
    <div className="blog-container">
      {/* 面包屑导航 */}
      <div className="blog-breadcrumb">
        <Breadcrumb items={[
          { title: <Link href="/"><HomeOutlined /> 首页</Link> },
          { title: <Link href="/scenic-spots">5A级景区名录</Link> },
          { title: spot.name },
        ]} />
      </div>

      {/* 封面图区域 */}
      <div className="hero-section">
        <div
          className="hero-image"
          style={{
            backgroundImage: `url(${heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="hero-overlay">
          <div className="hero-title-wrapper">
            <h1 className="hero-title">{spot.name}</h1>
            <div className="hero-meta">
              <span className="hero-meta-item">
                <EnvironmentOutlined />
                {spot.province} · {spot.city}
              </span>
              <Tag color="gold" className="hero-tag">AAAAA 级景区</Tag>
              {spot.images && (
                <span className="hero-meta-item">
                  <CameraOutlined />
                  {spot.images.length} 张实景图片
                </span>
              )}
              {spot.batch && (
                <span className="hero-meta-item">
                  <CalendarOutlined />
                  获批批次: {spot.batch}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 博客正文 */}
      <div className="blog-content-wrapper">
        <div className="blog-sidebar">
          <div className="sidebar-card">
            <h3 className="sidebar-title">📍 景区信息</h3>
            <div className="sidebar-info">
              <div className="info-row">
                <span className="info-label">所属省份</span>
                <span className="info-value">{spot.province}</span>
              </div>
              <div className="info-row">
                <span className="info-label">所在城市</span>
                <span className="info-value">{spot.city}</span>
              </div>
              <div className="info-row">
                <span className="info-label">景区等级</span>
                <span className="info-value"><Tag color="gold">5A</Tag></span>
              </div>
              {spot.location && (
                <div className="info-row">
                  <span className="info-label">经纬度</span>
                  <span className="info-value">
                    {spot.location.lat.toFixed(4)}, {spot.location.lng.toFixed(4)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="sidebar-card sidebar-actions">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddToItinerary}
              block
              size="large"
              className="action-btn-primary"
            >
              添加到我的行程
            </Button>
            <Button
              icon={<ShopOutlined />}
              onClick={() => alert('周边酒店功能即将上线')}
              block
              size="large"
              className="action-btn-secondary"
            >
              查看周边酒店
            </Button>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push('/scenic-spots')}
              block
              className="action-btn-secondary"
            >
              返回景区列表
            </Button>
          </div>
        </div>

        <div className="blog-main">
          {content?.body ? (
            <MarkdownRenderer content={content.body} spotPath={content.path} />
          ) : spot.intro ? (
            <MarkdownRenderer content={spot.intro} />
          ) : (
            <Empty description="暂无详细介绍" />
          )}
        </div>
      </div>
    </div>
  );
}
