import type { Metadata } from 'next';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AppProvider } from '@/store/AppContext';
import './globals.css';

export const metadata: Metadata = {
  title: '旅行住宿推荐',
  description: '搜索景点，智能推荐最佳住宿位置',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <ConfigProvider locale={zhCN}>
          <AppProvider>
            {children}
          </AppProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
