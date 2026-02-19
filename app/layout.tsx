import type { Metadata } from 'next'
import './globals.css'
import ClientLayout from '@/components/ClientLayout'

export const metadata: Metadata = {
  title: '라이브 커머스 플랫폼 - 분양형 쇼핑몰',
  description: '라이브 스트리머를 위한 분양형 쇼핑몰 플랫폼',
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
