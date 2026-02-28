'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AdminCharts from '@/components/dashboard/AdminCharts'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { useRouter } from 'next/navigation'

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
      PENDING: 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white',
      CONFIRMED: 'bg-gradient-to-r from-blue-400 to-blue-500 text-white',
      SHIPPING: 'bg-gradient-to-r from-purple-400 to-purple-500 text-white',
      DELIVERED: 'bg-gradient-to-r from-emerald-400 to-emerald-500 text-white',
      CANCELLED: 'bg-gradient-to-r from-red-400 to-red-500 text-white',
    }
    
    const labels: Record<string, string> = {
      PENDING: '⏳ 대기중',
      CONFIRMED: '✅ 확인됨',
      SHIPPING: '🚚 배송중',
      DELIVERED: '📦 배송완료',
      CANCELLED: '❌ 취소됨',
    }

    return (
      <span className={`px-4 py-2 rounded-xl text-sm font-black shadow-md ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    )
  }

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-purple-200 border-t-purple-600 mx-auto mb-6"></div>
          <p className="text-gray-600 font-bold text-lg">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Premium Header */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 shadow-2xl border-b-4 border-purple-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 flex items-center justify-center shadow-2xl">
                <span className="text-3xl">📊</span>
              </div>
              <div>
                <h1 className="text-4xl font-black text-white drop-shadow-lg">
                  관리자 대시보드
                </h1>
                <p className="mt-2 text-purple-200 text-lg font-medium">Enterprise Admin Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl px-6 py-3 border border-white/20">
                <div className="text-sm text-purple-200 font-medium">관리자</div>
                <div className="text-lg font-bold text-white">{user?.name}</div>
              </div>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-black text-2xl shadow-2xl ring-4 ring-white/20 hover:scale-110 transition-transform cursor-pointer">
                {user?.name?.charAt(0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Premium Navigation */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-2xl p-3 inline-flex space-x-2 border border-gray-200">
            <Link href="/admin" className="group px-8 py-4 bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 text-white rounded-xl shadow-xl font-bold flex items-center space-x-2 ring-4 ring-purple-200 scale-105">
              <span className="text-2xl">📊</span>
              <span>대시보드</span>
            </Link>
            <Link href="/admin/users" className="group px-8 py-4 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-bold flex items-center space-x-2 hover:scale-105 duration-200">
              <span className="text-2xl group-hover:scale-110 transition-transform">👥</span>
              <span>회원 관리</span>
            </Link>
            <Link href="/admin/orders" className="group px-8 py-4 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-bold flex items-center space-x-2 hover:scale-105 duration-200">
              <span className="text-2xl group-hover:scale-110 transition-transform">📦</span>
              <span>주문 관리</span>
            </Link>
            <Link href="/admin/partners" className="group px-8 py-4 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-bold flex items-center space-x-2 hover:scale-105 duration-200">
              <span className="text-2xl group-hover:scale-110 transition-transform">🤝</span>
              <span>파트너 관리</span>
            </Link>
            <Link href="/admin/products" className="group px-8 py-4 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-bold flex items-center space-x-2 hover:scale-105 duration-200">
              <span className="text-2xl group-hover:scale-110 transition-transform">🛍️</span>
              <span>상품 관리</span>
            </Link>
          </div>
        </div>

        {/* Premium Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 오늘 매출 */}
          <div className="group bg-gradient-to-br from-white to-blue-50 rounded-3xl shadow-2xl p-8 border-t-4 border-blue-500 hover:shadow-blue-200 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-blue-600 uppercase tracking-wider mb-2">💰 오늘 매출</div>
                <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600 mt-2 group-hover:scale-110 transition-transform">
                  {formatCurrency(stats?.todayRevenue || 0).replace('₩', '')}
                </div>
                <div className="text-xs text-gray-500 mt-3 font-semibold">{stats?.todayOrders || 0}건 주문</div>
              </div>
              <div className="w-20 h-20 bg-gradient-to-br from-blue-400 via-blue-500 to-cyan-600 rounded-3xl flex items-center justify-center shadow-xl group-hover:rotate-12 transition-transform">
                <span className="text-4xl">💰</span>
              </div>
            </div>
          </div>

          {/* 총 매출 */}
          <div className="group bg-gradient-to-br from-white to-purple-50 rounded-3xl shadow-2xl p-8 border-t-4 border-purple-500 hover:shadow-purple-200 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-purple-600 uppercase tracking-wider mb-2">📈 총 매출</div>
                <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 mt-2 group-hover:scale-110 transition-transform">
                  {formatCurrency(stats?.totalRevenue || 0).replace('₩', '')}
                </div>
                <div className="text-xs text-gray-500 mt-3 font-semibold">{stats?.totalOrders || 0}건 주문</div>
              </div>
              <div className="w-20 h-20 bg-gradient-to-br from-purple-400 via-purple-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-xl group-hover:rotate-12 transition-transform">
                <span className="text-4xl">📈</span>
              </div>
            </div>
          </div>

          {/* 파트너 */}
          <div className="group bg-gradient-to-br from-white to-emerald-50 rounded-3xl shadow-2xl p-8 border-t-4 border-emerald-500 hover:shadow-emerald-200 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-2">🤝 파트너</div>
                <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-green-600 mt-2 group-hover:scale-110 transition-transform">
                  {stats?.totalPartners || 0}
                </div>
                <div className="text-xs text-gray-500 mt-3 font-semibold">활성 파트너</div>
              </div>
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 via-emerald-500 to-green-600 rounded-3xl flex items-center justify-center shadow-xl group-hover:rotate-12 transition-transform">
                <span className="text-4xl">🤝</span>
              </div>
            </div>
          </div>

          {/* 제품 */}
          <div className="group bg-gradient-to-br from-white to-amber-50 rounded-3xl shadow-2xl p-8 border-t-4 border-amber-500 hover:shadow-amber-200 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-amber-600 uppercase tracking-wider mb-2">🛍️ 제품</div>
                <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600 mt-2 group-hover:scale-110 transition-transform">
                  {stats?.totalProducts || 0}
                </div>
                <div className="text-xs text-gray-500 mt-3 font-semibold">판매 중인 제품</div>
              </div>
              <div className="w-20 h-20 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 rounded-3xl flex items-center justify-center shadow-xl group-hover:rotate-12 transition-transform">
                <span className="text-4xl">🛍️</span>
              </div>
            </div>
          </div>

          {/* 고객 */}
          <div className="group bg-gradient-to-br from-white to-pink-50 rounded-3xl shadow-2xl p-8 border-t-4 border-pink-500 hover:shadow-pink-200 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-pink-600 uppercase tracking-wider mb-2">👤 고객</div>
                <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-600 mt-2 group-hover:scale-110 transition-transform">
                  {stats?.totalCustomers || 0}
                </div>
                <div className="text-xs text-gray-500 mt-3 font-semibold">전체 고객</div>
              </div>
              <div className="w-20 h-20 bg-gradient-to-br from-pink-400 via-pink-500 to-rose-600 rounded-3xl flex items-center justify-center shadow-xl group-hover:rotate-12 transition-transform">
                <span className="text-4xl">👤</span>
              </div>
            </div>
          </div>

          {/* 대기 주문 */}
          <div className="group bg-gradient-to-br from-white to-yellow-50 rounded-3xl shadow-2xl p-8 border-t-4 border-yellow-500 hover:shadow-yellow-200 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-yellow-600 uppercase tracking-wider mb-2">⏳ 대기 주문</div>
                <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-orange-600 mt-2 group-hover:scale-110 transition-transform">
                  {stats?.pendingOrders || 0}
                </div>
                <div className="text-xs text-gray-500 mt-3 font-semibold">처리 필요</div>
              </div>
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-600 rounded-3xl flex items-center justify-center shadow-xl group-hover:rotate-12 transition-transform">
                <span className="text-4xl">⏳</span>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="mb-8">
          <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-200">
            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center">
              <span className="text-3xl mr-3">📊</span>
              판매 통계
            </h2>
            <AdminCharts />
          </div>
        </div>

        {/* 2 Column Layout */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Recent Orders */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-gray-900 flex items-center">
                <span className="text-3xl mr-3">📦</span>
                최근 주문
              </h2>
              <Link href="/admin/orders" className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 font-bold shadow-lg hover:scale-110 transition-all">
                전체 보기 →
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-gray-500 font-semibold">주문이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order.id} className="border-2 border-gray-200 rounded-2xl p-6 hover:border-purple-300 hover:shadow-xl transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="font-mono text-lg font-black text-purple-700">{order.orderNumber}</p>
                        <p className="text-sm text-gray-600 font-medium mt-1">👤 {order.user?.name || '알 수 없음'}</p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-gray-600 font-medium">🏪 {order.partner?.storeName || '파트너 없음'}</span>
                      <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-gray-500 pt-3 border-t border-gray-200">
                      <span className="font-semibold">플랫폼 수익: {formatCurrency(order.platformRevenue)}</span>
                      <span className="font-medium">🕐 {formatDate(order.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Partners */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-gray-900 flex items-center">
                <span className="text-3xl mr-3">🤝</span>
                파트너 현황
              </h2>
              <Link href="/admin/partners" className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 font-bold shadow-lg hover:scale-110 transition-all">
                전체 보기 →
              </Link>
            </div>

            {partners.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-gray-500 font-semibold">파트너가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-4">
                {partners.map((partner) => (
                  <div key={partner.id} className="border-2 border-gray-200 rounded-2xl p-6 hover:border-emerald-300 hover:shadow-xl transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-lg font-black text-gray-900">{partner.storeName}</p>
                        <p className="text-sm text-gray-600 font-medium mt-1">👤 {partner.user.name}</p>
                        <p className="text-sm text-gray-500 mt-1">📧 {partner.user.email}</p>
                        <p className="text-xs text-gray-400 mt-1 font-mono">/{partner.storeSlug}</p>
                      </div>
                      <span className={`px-4 py-2 rounded-xl text-sm font-black shadow-md ${
                        partner.isActive 
                          ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 text-white' 
                          : 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-700'
                      }`}>
                        {partner.isActive ? '✅ 활성' : '⏸️ 비활성'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-3 border-t border-gray-200">
                      <span className="text-gray-700 font-bold">💳 수수료: {partner.commissionRate}%</span>
                      <span className="text-gray-700 font-bold">📦 주문: {partner._count.orders}건</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          <Link href="/admin/partners" className="group bg-gradient-to-br from-white to-emerald-50 rounded-3xl shadow-xl p-8 hover:shadow-2xl transition-all text-center border-2 border-transparent hover:border-emerald-300 hover:scale-105 duration-300">
            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">🤝</div>
            <h3 className="font-black text-xl text-gray-900">파트너 관리</h3>
            <p className="text-sm text-gray-500 mt-2">Partner Management</p>
          </Link>
          
          <Link href="/admin/products" className="group bg-gradient-to-br from-white to-amber-50 rounded-3xl shadow-xl p-8 hover:shadow-2xl transition-all text-center border-2 border-transparent hover:border-amber-300 hover:scale-105 duration-300">
            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">🛍️</div>
            <h3 className="font-black text-xl text-gray-900">제품 관리</h3>
            <p className="text-sm text-gray-500 mt-2">Product Management</p>
          </Link>
          
          <Link href="/admin/orders" className="group bg-gradient-to-br from-white to-blue-50 rounded-3xl shadow-xl p-8 hover:shadow-2xl transition-all text-center border-2 border-transparent hover:border-blue-300 hover:scale-105 duration-300">
            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📦</div>
            <h3 className="font-black text-xl text-gray-900">주문 관리</h3>
            <p className="text-sm text-gray-500 mt-2">Order Management</p>
          </Link>
          
          <Link href="/admin/settlements" className="group bg-gradient-to-br from-white to-purple-50 rounded-3xl shadow-xl p-8 hover:shadow-2xl transition-all text-center border-2 border-transparent hover:border-purple-300 hover:scale-105 duration-300">
            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">💰</div>
            <h3 className="font-black text-xl text-gray-900">정산 관리</h3>
            <p className="text-sm text-gray-500 mt-2">Settlement Management</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
