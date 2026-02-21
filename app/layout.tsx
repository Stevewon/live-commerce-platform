import type { Metadata } from 'next'
import './globals.css'
import ClientLayout from '@/components/ClientLayout'

export const metadata: Metadata = {
  title: {
    default: '라이브 커머스 플랫폼 - 분양형 쇼핑몰',
    template: '%s | 라이브 커머스 플랫폼',
  },
  description: '라이브 스트리머를 위한 분양형 쇼핑몰 플랫폼. 실시간 라이브 방송과 쇼핑을 한번에! Socket.io 실시간 채팅, 토스페이먼츠 결제, 파트너 정산 시스템.',
  keywords: ['라이브커머스', '쇼핑몰', '라이브방송', '실시간쇼핑', '파트너쇼핑몰', '분양형쇼핑몰'],
  authors: [{ name: 'Live Commerce Platform' }],
  creator: 'Live Commerce Platform',
  publisher: 'Live Commerce Platform',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: '라이브 커머스 플랫폼',
    description: '라이브 스트리머를 위한 분양형 쇼핑몰 플랫폼',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    siteName: '라이브 커머스 플랫폼',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '라이브 커머스 플랫폼',
    description: '라이브 스트리머를 위한 분양형 쇼핑몰 플랫폼',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Google Search Console 등록 후 추가
    // google: 'your-google-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
