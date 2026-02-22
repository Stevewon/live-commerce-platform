'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'

export function usePartnerAuth() {
  const router = useRouter()
  const { user, loading, logout } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/partner/login')
      return
    }

    if (user && user.role !== 'PARTNER') {
      router.push('/partner/login')
    }
  }, [user, loading, router])

  return { user, loading, logout, isPartner: user?.role === 'PARTNER' }
}
