'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AdminCharts from '@/components/dashboard/AdminCharts'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'

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

interface RecentOrder {
  id: string
  orderNumber: string
  total: number
  partnerRevenue: number
  platformRevenue: number
  status: string
  createdAt: string
  partner: {
    storeName: string
  } | null
  user: {
    name: string
  } | null
}

interface Partner {
  id: string
  storeName: string
  storeSlug: string
  commissionRate: number
  isActive: boolean
  user: {
    name: string
    email: string
  }
  _count: {
    orders: number
  }
}

export default function AdminDashboardPage() {
  const { user, loading: authLoading, logout } = useAdminAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      loadDashboardData()
    }
  }, [user])

  const loadDashboardData = async () => {
    try {
      const res = await fetch('/api/admin/dashboard', {
        credentials: 'include'
      })

      if (!res.ok) throw new Error('데이터 로드 실패')

      const data = await res.json()
      setStats(data.stats)
      setRecentOrders(data.recentOrders)
      setPartners(data.partners)
    } catch (err) {
      console.error('Dashboard data load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      SHIPPING: 'bg-purple-100 text-purple-800',
      DELIVERED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    }
    
    const labels: Record<string, string> = {
      PENDING: '대기중',
      CONFIRMED: '확인됨',
      SHIPPING: '배송중',
      DELIVERED: '배송완료',
      CANCELLED: '취소됨',
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    )
  }

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
              <p className="text-sm text-gray-600">플랫폼 전체 관리</p>
            </div>
            <div className="flex gap-2">
              <Link href="/admin/partners" className="btn btn-secondary">
                파트너 관리
              </Link>
              <Link href="/admin/products" className="btn btn-secondary">
                제품 관리
              </Link>
              <Link href="/admin/orders" className="btn btn-secondary">
                주문 관리
              </Link>
              <button onClick={handleLogout} className="btn btn-secondary">
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 오늘 매출 */}
          <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <h3 className="text-sm font-medium opacity-90 mb-2">오늘 매출</h3>
            <p className="text-3xl font-bold mb-1">
              {formatCurrency(stats?.todayRevenue || 0)}
            </p>
            <p className="text-sm opacity-75">{stats?.todayOrders || 0}건 주문</p>
          </div>

          {/* 총 매출 */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-600 mb-2">총 매출</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {formatCurrency(stats?.totalRevenue || 0)}
            </p>
            <p className="text-sm text-gray-500">{stats?.totalOrders || 0}건 주문</p>
          </div>

          {/* 파트너 */}
          <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
            <h3 className="text-sm font-medium opacity-90 mb-2">파트너</h3>
            <p className="text-3xl font-bold mb-1">
              {stats?.totalPartners || 0}명
            </p>
            <p className="text-sm opacity-75">활성 파트너</p>
          </div>

          {/* 제품 */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-600 mb-2">제품</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {stats?.totalProducts || 0}개
            </p>
            <p className="text-sm text-gray-500">판매 중인 제품</p>
          </div>

          {/* 고객 */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-600 mb-2">고객</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {stats?.totalCustomers || 0}명
            </p>
            <p className="text-sm text-gray-500">전체 고객</p>
          </div>

          {/* 대기 주문 */}
          <div className="card bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
            <h3 className="text-sm font-medium opacity-90 mb-2">대기 주문</h3>
            <p className="text-3xl font-bold mb-1">
              {stats?.pendingOrders || 0}건
            </p>
            <p className="text-sm opacity-75">처리 필요</p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="mb-8">
          <AdminCharts />
        </div>

        {/* 2 Column Layout */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Recent Orders */}
          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">최근 주문</h2>
              <Link href="/admin/orders" className="text-blue-600 hover:underline text-sm font-medium">
                전체 보기 →
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">주문이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-mono text-sm font-semibold">{order.orderNumber}</p>
                        <p className="text-sm text-gray-600">{order.user?.name || '알 수 없음'}</p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">{order.partner?.storeName || '파트너 없음'}</span>
                      <span className="font-semibold">{formatCurrency(order.total)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
                      <span>플랫폼: {formatCurrency(order.platformRevenue)}</span>
                      <span>{formatDate(order.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Partners */}
          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">파트너 현황</h2>
              <Link href="/admin/partners" className="text-blue-600 hover:underline text-sm font-medium">
                전체 보기 →
              </Link>
            </div>

            {partners.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">파트너가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-4">
                {partners.map((partner) => (
                  <div key={partner.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">{partner.storeName}</p>
                        <p className="text-sm text-gray-600">{partner.user.name} ({partner.user.email})</p>
                        <p className="text-xs text-gray-500 mt-1">/{partner.storeSlug}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        partner.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {partner.isActive ? '활성' : '비활성'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">수수료: {partner.commissionRate}%</span>
                      <span className="text-gray-600">주문: {partner._count.orders}건</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          <Link href="/admin/partners" className="card hover:shadow-md transition-shadow text-center">
            <div className="text-4xl mb-2">👥</div>
            <h3 className="font-medium">파트너 관리</h3>
          </Link>
          
          <Link href="/admin/products" className="card hover:shadow-md transition-shadow text-center">
            <div className="text-4xl mb-2">📦</div>
            <h3 className="font-medium">제품 관리</h3>
          </Link>
          
          <Link href="/admin/orders" className="card hover:shadow-md transition-shadow text-center">
            <div className="text-4xl mb-2">📋</div>
            <h3 className="font-medium">주문 관리</h3>
          </Link>
          
          <Link href="/admin/settlements" className="card hover:shadow-md transition-shadow text-center">
            <div className="text-4xl mb-2">💰</div>
            <h3 className="font-medium">정산 관리</h3>
          </Link>
        </div>
      </main>
    </div>
  )
}
