'use client'

import { useState, useEffect } from 'react'

interface AdminStats {
  totalRevenue: number
  totalOrders: number
  totalProducts: number
  totalPartners: number
  totalCustomers: number
  pendingOrders: number
  todayRevenue: number
  todayOrders: number
}

export default function AdminDashboardSimple() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/dashboard', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setStats(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            ⚡ 관리자 대시보드
          </h1>
          <p className="text-purple-200">실시간 플랫폼 운영 현황</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white transform hover:scale-105 transition-all">
            <div className="text-3xl mb-2">💰</div>
            <div className="text-2xl font-bold">
              ₩{stats?.todayRevenue?.toLocaleString() || 0}
            </div>
            <div className="text-blue-100 text-sm">오늘 매출</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white transform hover:scale-105 transition-all">
            <div className="text-3xl mb-2">📦</div>
            <div className="text-2xl font-bold">
              {stats?.todayOrders || 0}건
            </div>
            <div className="text-purple-100 text-sm">오늘 주문</div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white transform hover:scale-105 transition-all">
            <div className="text-3xl mb-2">🏪</div>
            <div className="text-2xl font-bold">
              {stats?.totalPartners || 0}개
            </div>
            <div className="text-green-100 text-sm">파트너</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white transform hover:scale-105 transition-all">
            <div className="text-3xl mb-2">👥</div>
            <div className="text-2xl font-bold">
              {stats?.totalCustomers || 0}명
            </div>
            <div className="text-orange-100 text-sm">고객</div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="/admin/users"
            className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white hover:bg-white/20 transition-all"
          >
            <div className="text-2xl mb-2">👥</div>
            <div className="font-semibold">회원 관리</div>
          </a>

          <a
            href="/admin/orders"
            className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white hover:bg-white/20 transition-all"
          >
            <div className="text-2xl mb-2">📦</div>
            <div className="font-semibold">주문 관리</div>
          </a>

          <a
            href="/admin/partners"
            className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white hover:bg-white/20 transition-all"
          >
            <div className="text-2xl mb-2">🏪</div>
            <div className="font-semibold">파트너 관리</div>
          </a>

          <a
            href="/admin/products"
            className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white hover:bg-white/20 transition-all"
          >
            <div className="text-2xl mb-2">📦</div>
            <div className="font-semibold">상품 관리</div>
          </a>
        </div>
      </div>
    </div>
  )
}
