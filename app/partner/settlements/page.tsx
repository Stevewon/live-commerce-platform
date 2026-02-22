'use client'

import { useEffect, useState } from 'react'
import { usePartnerAuth } from '@/lib/hooks/usePartnerAuth'

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
}

export default function PartnerSettlements() {
  const { user, loading: authLoading, logout } = usePartnerAuth()
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [availableAmount, setAvailableAmount] = useState(0)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestAmount, setRequestAmount] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSettlements()
    fetchAvailableAmount()
  }, [])

  const fetchSettlements = async () => {
    try {
      }

      const response = await fetch('/api/partner/settlements', {
        credentials: 'include',
        headers: {
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSettlements(data.settlements)
      } else if (response.status === 401) {
      }
    } catch (error) {
      console.error('Settlement fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableAmount = async () => {
    try {
      const response = await fetch('/api/partner/dashboard', {
        credentials: 'include',
        headers: {
        }
      })

      if (response.ok) {
        const data = await response.json()
        setAvailableAmount(data.stats.pendingSettlement)
      }
    } catch (error) {
      console.error('Available amount fetch error:', error)
    }
  }

  const handleRequestSettlement = async () => {
    try {
      setError('')
      const amount = parseFloat(requestAmount)

      if (isNaN(amount) || amount <= 0) {
        setError('유효한 금액을 입력해주세요')
        return
      }

      if (amount > availableAmount) {
        setError(`정산 가능 금액은 ${availableAmount.toLocaleString()}원입니다`)
        return
      }

      if (!bankAccount || !accountHolder) {
        setError('계좌 정보를 모두 입력해주세요')
        return
      }

      const response = await fetch('/api/partner/settlements', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount,
          bankAccount,
          accountHolder
        })
      })

      if (response.ok) {
        setShowRequestModal(false)
        setRequestAmount('')
        setBankAccount('')
        setAccountHolder('')
        fetchSettlements()
        fetchAvailableAmount()
        alert('정산 요청이 완료되었습니다')
      } else {
        const data = await response.json()
        setError(data.error || '정산 요청 중 오류가 발생했습니다')
      }
    } catch (error) {
      console.error('Settlement request error:', error)
      setError('정산 요청 중 오류가 발생했습니다')
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
          <p className="mt-2 text-gray-600">정산 내역을 확인하고 정산을 요청하세요</p>
        </div>

        {/* 정산 가능 금액 카드 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">정산 가능 금액</p>
              <p className="text-3xl font-bold text-blue-600">
                ₩{availableAmount.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                배송 완료된 주문의 수익금만 정산 가능합니다
              </p>
            </div>
            <button
              onClick={() => setShowRequestModal(true)}
              disabled={availableAmount === 0}
              className={`px-6 py-3 rounded-lg font-semibold ${
                availableAmount > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              정산 요청
            </button>
          </div>
        </div>

        {/* 정산 내역 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">정산 내역</h2>
          </div>

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
                      처리일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      비고
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {settlements.map((settlement) => (
                    <tr key={settlement.id} className="hover:bg-gray-50">
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
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {settlement.processedAt
                          ? new Date(settlement.processedAt).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {settlement.rejectReason || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 정산 요청 모달 */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">정산 요청</h3>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  정산 금액
                </label>
                <input
                  type="number"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-sm text-gray-500">
                  최대: ₩{availableAmount.toLocaleString()}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  계좌번호
                </label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="은행명 계좌번호 (예: 우리은행 1002-123-456789)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  예금주
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="예금주 이름"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => {
                  setShowRequestModal(false)
                  setError('')
                  setRequestAmount('')
                  setBankAccount('')
                  setAccountHolder('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleRequestSettlement}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                요청하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
