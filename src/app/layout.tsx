import type { Metadata } from 'next';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AppProvider } from '@/store/AppContext';
import './globals.css';

const SITE_URL = 'https://checkinwhere.site';
const SITE_NAME = '住哪儿 · CheckinWhere';
const SITE_TITLE = '住哪儿 · 多景点旅行住宿推荐工具 | CheckinWhere';
const DESCRIPTION =
  'CheckinWhere 是一个旅行住宿位置推荐工具。添加多个景点后，根据公交和地铁通勤时间，智能推荐更适合作为城市旅行中转点的住宿区域，适合自由行、周末游和多景点行程规划。';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    'CheckinWhere',
    'checkinwhere',
    '住哪儿',
    '住哪里方便',
    '多景点住宿推荐',
    '旅行住宿推荐',
    '旅游住哪里',
    '景点附近住宿',
    '城市旅行规划',
    '自由行住宿推荐',
    '公交住宿',
    '地铁住宿',
    '旅行助手',
  ],
  authors: [{ name: 'CheckinWhere' }],
  creator: 'CheckinWhere',
  publisher: 'CheckinWhere',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    title: SITE_TITLE,
    description: DESCRIPTION,
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SITE_NAME,
  alternateName: ['CheckinWhere', '住哪儿', 'checkinwhere.site'],
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: 'TravelApplication',
  operatingSystem: 'Web',
  inLanguage: 'zh-CN',
  keywords: 'CheckinWhere, 住哪儿, 多景点住宿推荐, 旅行住宿推荐, 城市旅行规划, 公交住宿, 地铁住宿',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'CNY',
  },
  featureList: [
    '多景点旅行住宿位置推荐',
    '根据公交和地铁通勤时间排序',
    '城市地图定位',
    '随机目的地选择',
    '景点搜索与管理',
    '公共交通住宿智能推荐',
    '周边景点餐厅购物标注',
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <ConfigProvider locale={zhCN}>
          <AppProvider>{children}</AppProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
