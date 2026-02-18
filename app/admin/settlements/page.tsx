'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Settlement {
  id: string
  amount: number
  status: string
  bankAccount?: string
  accountHolder?: string
  requestDate: string
  processedAt?: string
  completedAt?: string
  rejectReason?: string
  partner: {
    storeName: string
    user: {
      email: string
      name: string | null
    }
  }
}

export default function AdminSettlements() {
  const router = useRouter()
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    fetchSettlements()
  }, [filter])

  const fetchSettlements = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/admin/login')
        return
      }

      const url = filter === 'ALL'
        ? '/api/admin/settlements'
        : `/api/admin/settlements?status=${filter}`

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSettlements(data.settlements)
      } else if (response.status === 401) {
        router.push('/admin/login')
      }
    } catch (error) {
      console.error('Settlement fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (settlement: Settlement) => {
    if (!confirm(`${settlement.partner.storeName}의 정산을 승인하시겠습니까?`)) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/settlements/${settlement.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'APPROVED' })
      })

      if (response.ok) {
        alert('정산이 승인되었습니다')
        fetchSettlements()
      } else {
        alert('정산 승인 중 오류가 발생했습니다')
      }
    } catch (error) {
      console.error('Settlement approve error:', error)
      alert('정산 승인 중 오류가 발생했습니다')
    }
  }

  const handleReject = async () => {
    if (!selectedSettlement) return

    if (!rejectReason.trim()) {
      alert('거절 사유를 입력해주세요')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/settlements/${selectedSettlement.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'REJECTED',
          rejectReason
        })
      })

      if (response.ok) {
        alert('정산이 거절되었습니다')
        setShowModal(false)
        setRejectReason('')
        setSelectedSettlement(null)
        fetchSettlements()
      } else {
        alert('정산 거절 중 오류가 발생했습니다')
      }
    } catch (error) {
      console.error('Settlement reject error:', error)
      alert('정산 거절 중 오류가 발생했습니다')
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      'PENDING': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '대기중' },
      'APPROVED': { bg: 'bg-green-100', text: 'text-green-800', label: '승인됨' },
      'REJECTED': { bg: 'bg-red-100', text: 'text-red-800', label: '거절됨' },
      'COMPLETED': { bg: 'bg-blue-100', text: 'text-blue-800', label: '완료' }
    }

    const badge = badges[status] || badges['PENDING']
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  const stats = {
    total: settlements.length,
    pending: settlements.filter(s => s.status === 'PENDING').length,
    approved: settlements.filter(s => s.status === 'APPROVED').length,
    rejected: settlements.filter(s => s.status === 'REJECTED').length,
    totalAmount: settlements.reduce((sum, s) => sum + s.amount, 0),
    pendingAmount: settlements.filter(s => s.status === 'PENDING').reduce((sum, s) => sum + s.amount, 0)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">정산 관리</h1>
          <p className="mt-2 text-gray-600">파트너 정산 요청을 관리하세요</p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">총 정산 건수</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">대기 중</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">총 정산 금액</p>
            <p className="text-2xl font-bold text-blue-600">₩{stats.totalAmount.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">대기 중 금액</p>
            <p className="text-2xl font-bold text-orange-600">₩{stats.pendingAmount.toLocaleString()}</p>
          </div>
        </div>

        {/* 필터 버튼 */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex flex-wrap gap-2">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'ALL' ? '전체' :
                 status === 'PENDING' ? '대기중' :
                 status === 'APPROVED' ? '승인됨' : '거절됨'}
              </button>
            ))}
          </div>
        </div>

        {/* 정산 내역 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {settlements.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500">정산 내역이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      파트너
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      요청일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      금액
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      계좌 정보
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {settlements.map((settlement) => (
                    <tr key={settlement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {settlement.partner.storeName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {settlement.partner.user.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(settlement.requestDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ₩{settlement.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {settlement.bankAccount}
                        <br />
                        <span className="text-xs text-gray-500">{settlement.accountHolder}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(settlement.status)}
                        {settlement.rejectReason && (
                          <div className="text-xs text-red-600 mt-1">
                            {settlement.rejectReason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {settlement.status === 'PENDING' && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApprove(settlement)}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => {
                                setSelectedSettlement(settlement)
                                setShowModal(true)
                              }}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              거절
                            </button>
                          </div>
                        )}
                        {settlement.status !== 'PENDING' && (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 거절 사유 입력 모달 */}
      {showModal && selectedSettlement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">정산 거절</h3>
            <p className="text-gray-600 mb-4">
              {selectedSettlement.partner.storeName}의 정산을 거절하시겠습니까?
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                거절 사유 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="거절 사유를 입력해주세요"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowModal(false)
                  setRejectReason('')
                  setSelectedSettlement(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                거절하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
