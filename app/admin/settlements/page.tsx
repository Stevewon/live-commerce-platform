'use client'

import { useEffect, useState } from 'react'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'

interface Settlement {
  id: string
  partnerId: string
  startDate: string
  endDate: string
  totalAmount: number
  commissionAmount: number
  settlementAmount: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  requestedAt: string
  paidAt: string | null
  rejectionReason: string | null
  partner: {
    storeName: string
    slug: string
    commissionRate: number
    bankAccount: string | null
    user: {
      name: string
      email: string
      phone: string | null
    }
  }
}

interface Order {
  id: string
  orderNumber: string
  total: number
  createdAt: string
  user: {
    name: string
    email: string
  }
  items: Array<{
    quantity: number
    price: number
    product: {
      name: string
    }
  }>
}

export default function AdminSettlementsPage() {
  const { user, loading: authLoading, logout } = useAdminAuth()
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // 상세 모달
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null)
  const [orders, setOrders] = useState<Order[]>([])

  // 거부 모달
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  useEffect(() => {
    // 인증 확인
    }

    fetchSettlements()
  }, [statusFilter])

  const fetchSettlements = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const res = await fetch(`/api/admin/settlements?${params}`, {
        credentials: 'include',
      headers: {
        }
      })

      const data = await res.json()
      if (data.settlements) {
        setSettlements(data.settlements)
      }
    } catch (error) {
      console.error('정산 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetail = async (settlement: Settlement) => {
    try {
      const res = await fetch(`/api/admin/settlements/${settlement.id}`, {
        credentials: 'include',
      headers: {
        }
      })

      const data = await res.json()
      if (data.success) {
        setSelectedSettlement(data.data.settlement)
        setOrders(data.data.orders)
        setShowDetailModal(true)
      }
    } catch (error) {
      console.error('정산 상세 조회 실패:', error)
    }
  }

  const handleApprove = async (id: string) => {
    if (!confirm('이 정산을 승인하시겠습니까?')) return

    try {
      const res = await fetch(`/api/admin/settlements/${id}`, {
        method: 'PATCH',
        credentials: 'include',
      headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'APPROVED' })
      })

      const data = await res.json()
      if (data.success) {
        alert(data.message)
        fetchSettlements()
        setShowDetailModal(false)
      } else {
        alert(data.error || '승인 실패')
      }
    } catch (error) {
      console.error('정산 승인 실패:', error)
      alert('정산 승인에 실패했습니다')
    }
  }

  const handleReject = (settlement: Settlement) => {
    setSelectedSettlement(settlement)
    setRejectionReason('')
    setShowRejectModal(true)
  }

  const handleSubmitReject = async () => {
    if (!selectedSettlement) return
    if (!rejectionReason.trim()) {
      alert('거부 사유를 입력해주세요')
      return
    }

    try {
      const res = await fetch(`/api/admin/settlements/${selectedSettlement.id}`, {
        method: 'PATCH',
        credentials: 'include',
      headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'REJECTED',
          rejectionReason
        })
      })

      const data = await res.json()
      if (data.success) {
        alert(data.message)
        setShowRejectModal(false)
        setShowDetailModal(false)
        fetchSettlements()
      } else {
        alert(data.error || '거부 실패')
      }
    } catch (error) {
      console.error('정산 거부 실패:', error)
      alert('정산 거부에 실패했습니다')
    }
  }

  const filteredSettlements = settlements.filter(settlement =>
    settlement.partner.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    settlement.partner.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    settlement.partner.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR')
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800'
    }
    const labels = {
      PENDING: '대기중',
      APPROVED: '승인완료',
      REJECTED: '거부됨'
    }
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('role')
  }

  // 통계 계산
  const stats = {
    total: settlements.length,
    pending: settlements.filter(s => s.status === 'PENDING').length,
    approved: settlements.filter(s => s.status === 'APPROVED').length,
    rejected: settlements.filter(s => s.status === 'REJECTED').length,
    totalPending: settlements
      .filter(s => s.status === 'PENDING')
      .reduce((sum, s) => sum + s.settlementAmount, 0),
    totalApproved: settlements
      .filter(s => s.status === 'APPROVED')
      .reduce((sum, s) => sum + s.settlementAmount, 0)
  }

  if (loading && settlements.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">정산 관리</h1>
              <p className="text-sm text-gray-500 mt-1">전체 {stats.total}건</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                대시보드
              </button>
              <button
                onClick={() => router.push('/admin/orders')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                주문관리
              </button>
              <button
                onClick={() => router.push('/admin/partners')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                파트너관리
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">대기중</h3>
            <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.pending}</p>
            <p className="text-sm text-gray-500 mt-1">{formatCurrency(stats.totalPending)}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">승인완료</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">{stats.approved}</p>
            <p className="text-sm text-gray-500 mt-1">{formatCurrency(stats.totalApproved)}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">거부됨</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">{stats.rejected}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">총 건수</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">{stats.total}</p>
          </div>
        </div>

        {/* 필터 및 검색 */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 상태 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상태
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체</option>
                <option value="PENDING">대기중</option>
                <option value="APPROVED">승인완료</option>
                <option value="REJECTED">거부됨</option>
              </select>
            </div>

            {/* 검색 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                검색
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="스토어명, 담당자명, 이메일 검색..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                >
                  초기화
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 정산 목록 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    파트너
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    정산기간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    매출액
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    수수료
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    정산금액
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSettlements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      정산 내역이 없습니다
                    </td>
                  </tr>
                ) : (
                  filteredSettlements.map((settlement) => (
                    <tr key={settlement.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{settlement.partner.storeName}</div>
                        <div className="text-sm text-gray-500">{settlement.partner.user.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(settlement.startDate)}
                        </div>
                        <div className="text-sm text-gray-500">
                          ~ {formatDate(settlement.endDate)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(settlement.totalAmount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-red-600">
                          -{formatCurrency(settlement.commissionAmount)}
                        </span>
                        <div className="text-xs text-gray-500">
                          ({settlement.partner.commissionRate}%)
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-green-600">
                          {formatCurrency(settlement.settlementAmount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(settlement.status)}
                        {settlement.paidAt && (
                          <div className="text-xs text-gray-500 mt-1">
                            {formatDate(settlement.paidAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewDetail(settlement)}
                            className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                          >
                            상세
                          </button>
                          {settlement.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApprove(settlement.id)}
                                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition"
                              >
                                승인
                              </button>
                              <button
                                onClick={() => handleReject(settlement)}
                                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition"
                              >
                                거부
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 상세 모달 */}
      {showDetailModal && selectedSettlement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">정산 상세 정보</h2>
              
              <div className="space-y-6">
                {/* 파트너 정보 */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-3">파트너 정보</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">스토어명:</span>
                      <span className="ml-2 font-medium">{selectedSettlement.partner.storeName}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">담당자:</span>
                      <span className="ml-2 font-medium">{selectedSettlement.partner.user.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">이메일:</span>
                      <span className="ml-2 font-medium">{selectedSettlement.partner.user.email}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">연락처:</span>
                      <span className="ml-2 font-medium">{selectedSettlement.partner.user.phone || '-'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">계좌정보:</span>
                      <span className="ml-2 font-medium">{selectedSettlement.partner.bankAccount || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* 정산 정보 */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-3">정산 정보</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">정산기간:</span>
                      <span className="font-medium">
                        {formatDate(selectedSettlement.startDate)} ~ {formatDate(selectedSettlement.endDate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">총 매출액:</span>
                      <span className="font-semibold text-blue-600">
                        {formatCurrency(selectedSettlement.totalAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">수수료 ({selectedSettlement.partner.commissionRate}%):</span>
                      <span className="font-semibold text-red-600">
                        -{formatCurrency(selectedSettlement.commissionAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-300">
                      <span className="font-semibold">정산금액:</span>
                      <span className="font-bold text-green-600 text-lg">
                        {formatCurrency(selectedSettlement.settlementAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">요청일:</span>
                      <span className="font-medium">{formatDate(selectedSettlement.requestedAt)}</span>
                    </div>
                    {selectedSettlement.paidAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">지급일:</span>
                        <span className="font-medium">{formatDate(selectedSettlement.paidAt)}</span>
                      </div>
                    )}
                    {selectedSettlement.rejectionReason && (
                      <div className="pt-2 border-t border-gray-300">
                        <span className="text-gray-500">거부 사유:</span>
                        <p className="mt-1 text-red-600 font-medium">{selectedSettlement.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 주문 내역 */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-3">주문 내역 ({orders.length}건)</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {orders.map(order => (
                      <div key={order.id} className="bg-white p-3 rounded border border-gray-200">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{order.orderNumber}</div>
                            <div className="text-xs text-gray-500">{order.user.name} ({order.user.email})</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {order.items.map(item => `${item.product.name} x${item.quantity}`).join(', ')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-gray-900">
                              {formatCurrency(order.total)}
                            </div>
                            <div className="text-xs text-gray-500">{formatDate(order.createdAt)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                {selectedSettlement.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleApprove(selectedSettlement.id)}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => handleReject(selectedSettlement)}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                    >
                      거부
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 거부 모달 */}
      {showRejectModal && selectedSettlement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">정산 거부</h2>
              <p className="text-sm text-gray-600 mb-4">
                {selectedSettlement.partner.storeName}의 정산을 거부합니다.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  거부 사유 *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="거부 사유를 입력해주세요"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSubmitReject}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  거부
                </button>
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
