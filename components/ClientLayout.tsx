'use client'

import { AuthProvider } from '@/lib/contexts/AuthContext'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'
import MobileBottomNav from '@/components/MobileBottomNav'
import Footer from '@/components/Footer'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <LanguageProvider>
      <AuthProvider>
        {/* 모바일 하단 고정 탭(MobileBottomNav, h-14=56px + iOS 홈바)이 페이지
            맨 아래 콘텐츠(예: 상품목록 페이지네이션 1 2 3 4 5)를 가리지 않도록
            모바일에서만 하단 여백을 준다. 데스크톱(md 이상)은 하단탭이 없으므로 pb-0. */}
        <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          {children}
        </div>
        <Footer />
        <MobileBottomNav />
      </AuthProvider>
    </LanguageProvider>
  )
}
