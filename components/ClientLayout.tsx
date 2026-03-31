'use client'

import { AuthProvider } from '@/lib/contexts/AuthContext'
import MobileBottomNav from '@/components/MobileBottomNav'
import Footer from '@/components/Footer'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      {children}
      <Footer />
      <MobileBottomNav />
    </AuthProvider>
  )
}
