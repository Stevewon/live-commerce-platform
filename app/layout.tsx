import type { Metadata, Viewport } from 'next'
import './globals.css'
import ClientLayout from '@/components/ClientLayout'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#1f2937',
}

export const metadata: Metadata = {
  title: {
    default: '큐라이브 플랫폼 - 분양형 쇼핑몰',
    template: '%s | 큐라이브 플랫폼',
  },
  description: '라이브 스트리머를 위한 분양형 쇼핑몰 플랫폼. 실시간 라이브 방송과 쇼핑을 한번에! Socket.io 실시간 채팅, 토스페이먼츠 결제, 파트너 정산 시스템.',
  keywords: ['큐라이브', '쇼핑몰', '라이브방송', '실시간쇼핑', '파트너쇼핑몰', '분양형쇼핑몰'],
  authors: [{ name: 'QRLIVE Platform' }],
  creator: 'QRLIVE Platform',
  publisher: 'QRLIVE Platform',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io'),
  openGraph: {
    title: '큐라이브 플랫폼',
    description: '라이브 스트리머를 위한 분양형 쇼핑몰 플랫폼',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://qrlive.io',
    siteName: '큐라이브 플랫폼',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '큐라이브 플랫폼',
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
