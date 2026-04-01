'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePartnerAuth } from '@/lib/hooks/usePartnerAuth'
import PartnerCharts from '@/components/dashboard/PartnerCharts'

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
  const { user, loading: authLoading, logout } = usePartnerAuth()
  const [partner, setPartner] = useState<PartnerInfo | null>(null)
  const [stats, setStats] = useState<PartnerStats | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingApproval, setPendingApproval] = useState(false)

  useEffect(() => {
    if (user && user.role === 'PARTNER') {
      loadDashboardData()
    }
  }, [user])

  const loadDashboardData = async () => {
    try {
      const res = await fetch('/api/partner/dashboard', {
        credentials: 'include'
      })

      const data = await res.json()

      if (!res.ok) {
        // 파트너 승인 대기 상태 체크
        if (res.status === 403 && data.error?.includes('승인 대기')) {
          setPendingApproval(true)
          setLoading(false)
          return
        }
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

  // 파트너 승인 대기 화면
  if (pendingApproval) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-6xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">관리자 승인 대기 중</h1>
            <p className="text-gray-600 mb-6">
              파트너 등록이 완료되었습니다.<br />
              관리자 승인 후 대시보드와 스토어 기능을 이용하실 수 있습니다.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-semibold text-blue-800 mb-2">승인 절차 안내</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>1. 관리자가 파트너 신청 내용을 검토합니다</li>
                <li>2. 승인 완료 시 스토어가 활성화됩니다</li>
                <li>3. 제품 선택 및 판매를 시작할 수 있습니다</li>
              </ul>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
              >
                승인 상태 새로고침
              </button>
              <button
                onClick={handleLogout}
                className="w-full py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
              >
                로그아웃
              </button>
              <Link
                href="/"
                className="block w-full py-3 px-4 text-gray-500 text-sm hover:text-gray-700 transition"
              >
                홈으로 돌아가기
              </Link>
            </div>
          </div>
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

        {/* Charts Section */}
        <div className="mb-8">
          <PartnerCharts />
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
