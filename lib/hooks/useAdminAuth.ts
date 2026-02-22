'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'

export function useAdminAuth() {
  const router = useRouter()
  const { user, loading, logout } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/admin/login')
      return
    }

    if (user && user.role !== 'ADMIN') {
      router.push('/admin/login')
    }
  }, [user, loading, router])

  return { user, loading, logout, isAdmin: user?.role === 'ADMIN' }
}
