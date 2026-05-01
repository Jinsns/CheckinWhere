import type { Metadata } from 'next';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AppProvider } from '@/store/AppContext';
import './globals.css';

const SITE_URL = 'https://checkinwhere.site';
const SITE_NAME = '住哪儿 · CheckinWhere';
const DESCRIPTION =
  '旅行住宿智能推荐工具。添加多个景点后，根据公共交通通勤时间，自动找到到各景点最便利的住宿位置。支持随机目的地选择，适合有选择困难症的旅行者。';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — 旅行住宿智能推荐`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    '旅行住宿推荐',
    '景点附近住宿',
    '住哪里',
    '旅游规划',
    '公交住宿',
    '地铁住宿',
    '旅行助手',
    '智能推荐',
    '景点住宿',
    '旅游住宿',
    'checkinwhere',
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
    title: `${SITE_NAME} — 旅行住宿智能推荐`,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    title: `${SITE_NAME} — 旅行住宿智能推荐`,
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
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: 'TravelApplication',
  operatingSystem: 'Web',
  inLanguage: 'zh-CN',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'CNY',
  },
  featureList: [
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
