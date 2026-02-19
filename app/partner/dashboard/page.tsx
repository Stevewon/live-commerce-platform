'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/contexts/AuthContext'

interface PartnerStats {
  totalSales: number
  totalOrders: number
  pendingSettlement: number
  completedSettlement: number
  activeProducts: number
  todaySales: number
}

interface RecentOrder {
  id: string
  orderNumber: string
  total: number
  partnerRevenue: number | null
  status: string
  createdAt: string
}

interface PartnerInfo {
  id: string
  storeName: string
  storeSlug: string
}

export default function PartnerDashboardPage() {
  const router = useRouter()
  const { user, token, logout: authLogout } = useAuth()
  const [partner, setPartner] = useState<PartnerInfo | null>(null)
  const [stats, setStats] = useState<PartnerStats | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // 인증 확인
    if (!user || !token) {
      router.push('/partner/login')
      return
    }

    if (user.role !== 'PARTNER') {
      alert('파트너 권한이 필요합니다')
      router.push('/partner/login')
      return
    }

    loadDashboardData()
  }, [user, token, router])

  const loadDashboardData = async () => {
    if (!token) return

    try {
      const res = await fetch('/api/partner/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '데이터 로드 실패')
      }

      setPartner(data.partner)
      setStats(data.stats)
      setRecentOrders(data.recentOrders)
    } catch (err: any) {
      console.error('Dashboard data load error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    authLogout()
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

  if (loading) {
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
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">파트너 대시보드</h1>
              <p className="text-sm text-gray-600">환영합니다, {user?.name}님!</p>
            </div>
            <div className="flex gap-2">
              <Link href="/partner/products" className="btn btn-secondary">
                제품 관리
              </Link>
              <Link href="/partner/orders" className="btn btn-secondary">
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
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* 오늘 매출 */}
          <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <h3 className="text-sm font-medium opacity-90 mb-2">오늘 매출</h3>
            <p className="text-3xl font-bold mb-1">
              {formatCurrency(stats?.todaySales || 0)}
            </p>
            <p className="text-sm opacity-75">실시간 업데이트</p>
          </div>

          {/* 총 매출 */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-600 mb-2">총 매출</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {formatCurrency(stats?.totalSales || 0)}
            </p>
            <p className="text-sm text-gray-500">누적 판매액</p>
          </div>

          {/* 총 주문 */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-600 mb-2">총 주문</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {stats?.totalOrders || 0}건
            </p>
            <p className="text-sm text-gray-500">누적 주문 건수</p>
          </div>

          {/* 정산 대기 */}
          <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
            <h3 className="text-sm font-medium opacity-90 mb-2">정산 대기</h3>
            <p className="text-3xl font-bold mb-1">
              {formatCurrency(stats?.pendingSettlement || 0)}
            </p>
            <p className="text-sm opacity-75">정산 예정 금액</p>
          </div>

          {/* 정산 완료 */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-600 mb-2">정산 완료</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {formatCurrency(stats?.completedSettlement || 0)}
            </p>
            <p className="text-sm text-gray-500">총 정산 금액</p>
          </div>

          {/* 판매 제품 */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-600 mb-2">판매 제품</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {stats?.activeProducts || 0}개
            </p>
            <p className="text-sm text-gray-500">활성화된 제품</p>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">최근 주문</h2>
            <Link href="/partner/orders" className="text-blue-600 hover:underline text-sm font-medium">
              전체 보기 →
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">아직 주문이 없습니다</p>
              <Link href="/partner/products" className="btn btn-primary mt-4 inline-block">
                제품 추가하기
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">주문번호</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">주문금액</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">내 수익</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">상태</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">주문일시</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-sm">{order.orderNumber}</td>
                      <td className="py-3 px-4 font-semibold">{formatCurrency(order.total)}</td>
                      <td className="py-3 px-4 font-semibold text-green-600">
                        {formatCurrency(order.partnerRevenue || 0)}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(order.status)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{formatDate(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          <Link href="/partner/products" className="card hover:shadow-md transition-shadow text-center">
            <div className="text-4xl mb-2">📦</div>
            <h3 className="font-medium">제품 관리</h3>
          </Link>
          
          <Link href="/partner/orders" className="card hover:shadow-md transition-shadow text-center">
            <div className="text-4xl mb-2">📋</div>
            <h3 className="font-medium">주문 관리</h3>
          </Link>
          
          <Link href="/partner/settlement" className="card hover:shadow-md transition-shadow text-center">
            <div className="text-4xl mb-2">💰</div>
            <h3 className="font-medium">정산 내역</h3>
          </Link>
          
          <Link href="/partner/live" className="card hover:shadow-md transition-shadow text-center">
            <div className="text-4xl mb-2">📺</div>
            <h3 className="font-medium">라이브 관리</h3>
          </Link>
        </div>
      </main>
    </div>
  )
}
