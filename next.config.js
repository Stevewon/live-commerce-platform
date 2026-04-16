const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ── 워크스페이스 루트를 이 프로젝트 디렉토리로 고정 ──
  // /home/user/webapp 에 별도 package.json+node_modules가 존재하여
  // Next.js가 상위 디렉토리를 workspace root로 오인하는 문제를 방지
  outputFileTracingRoot: path.resolve(__dirname),

  images: {
    domains: ['localhost', 'qrlive.io', 'www.qrlive.io', 'images.unsplash.com'],
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // API 라우트 처리
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
      // HTML 페이지는 CDN 캐시 짧게 설정 (배포 시 이전 빌드 캐시 문제 방지)
      {
        source: '/:path*',
        headers: [
          { key: 'CDN-Cache-Control', value: 'max-age=60' },
        ],
      },
    ];
  },
}

module.exports = nextConfig
