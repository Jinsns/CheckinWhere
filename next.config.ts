import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
      {
        protocol: 'https',
        hostname: '**.byteimg.com',
      },
      {
        protocol: 'https',
        hostname: '**.pstatp.com',
      },
    ],
  },
};

export default nextConfig;
