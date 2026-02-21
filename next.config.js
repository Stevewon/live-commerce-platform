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
