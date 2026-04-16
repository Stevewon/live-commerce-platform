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
        {children}
        <Footer />
        <MobileBottomNav />
      </AuthProvider>
    </LanguageProvider>
  )
}
