/** @type {import('next').NextConfig} */
const nextConfig = {
  // 프로덕션 최적화
  reactStrictMode: true,
  swcMinify: true,
  
  // 이미지 최적화
  images: {
    domains: ['localhost', 'res.cloudinary.com', 'placehold.co'],
    formats: ['image/avif', 'image/webp'],
  },
  
  // Cloudflare를 통한 커스텀 도메인 허용
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
  
  // 허용된 도메인 설정
  allowedDevOrigins: [
    'https://qrlive.io',
    'https://www.qrlive.io',
    'https://3000-iw573oqulzos23ae750sv-18e660f9.sandbox.novita.ai',
  ],
  
  // 환경 변수 (클라이언트에서 사용 가능)
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  
  // 번들 크기 최적화
  experimental: {
    optimizePackageImports: ['recharts', '@prisma/client'],
  },
  
  // TypeScript 및 ESLint
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  
  // 커스텀 서버 (server.js) 사용
  // Railway 배포 시에는 standalone 모드 사용
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
};

module.exports = nextConfig;
