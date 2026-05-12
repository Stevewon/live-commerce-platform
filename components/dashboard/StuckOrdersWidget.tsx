'use client'

import { useEffect, useState } from 'react'

/**
 * [2026-05-12 옵션 3-3] 어드민 대시보드 stuck-orders 위젯
 *
 * 표시 대상:
 * - PENDING + KISPG 진입마커(결제대기/결제창진입/신용카드) + paymentKey 없음
 * - 5분 ~ 24시간 사이
 *
 * UI:
 * - 0건: 초록 ✓ (정상)
 * - 1건 이상: 노란/빨간 경고 + 각 주문별 카드 (KISPG 콘솔 링크 + settid 원클릭)
 */

interface StuckOrder {
  id: string
  orderNumber: string
  paymentMethod: string | null
  total: number
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  userId: string | null
  isGuest: boolean
  createdAt: string
  ageMinutes: number | null
}

interface StuckOrdersResponse {
  success: boolean
  count: number
  items: StuckOrder[]
  scannedAt: string
}

export default function StuckOrdersWidget() {
  const [items, setItems] = useState<StuckOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scannedAt, setScannedAt] = useState<string | null>(null)
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const load = async () => {
    setError(null)
    try {
      const res = await fetch('/api/admin/stuck-orders', { credentials: 'include' })
      if (!res.ok) {
        setError(`HTTP ${res.status}`)
        setLoading(false)
        return
      }
      const data: StuckOrdersResponse = await res.json()
      setItems(data.items || [])
      setScannedAt(data.scannedAt || null)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // 30초마다 자동 갱신 (사장님이 페이지 열어둔 동안 실시간 감지)
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleManualResolve = async (order: StuckOrder) => {
    const tid = window.prompt(
      `[${order.orderNumber}] KISPG 콘솔에서 확인한 실제 TID 를 입력해주세요\n` +
      `(주문자: ${order.customerName || '비회원'} / ₩${order.total.toLocaleString()})`,
      ''
    )
    if (!tid || !tid.trim()) return
    const confirmed = window.confirm(
      `다음 TID 로 paymentKey 를 덮어쓰고 CONFIRMED 처리합니다.\n\n` +
      `주문번호: ${order.orderNumber}\n` +
      `TID: ${tid.trim()}\n\n` +
      `진행하시겠습니까?`
    )
    if (!confirmed) return

    setBusyOrderId(order.id)
    setActionMsg(null)
    try {
      const res = await fetch('/api/payments/kispg/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId: order.id,
          tid: tid.trim(),
          payMethod: order.paymentMethod || 'card',
          amount: order.total,
        }),
      })
      const data: any = await res.json().catch(() => ({}))
      if (res.ok && data?.success) {
        setActionMsg(`✅ ${order.orderNumber} 처리 완료`)
        await load()
      } else {
        setActionMsg(`❌ ${order.orderNumber} 처리 실패: ${data?.error || res.status}`)
      }
    } catch (e: any) {
      setActionMsg(`❌ ${order.orderNumber} 예외: ${e?.message || String(e)}`)
    } finally {
      setBusyOrderId(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-gray-300 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-64 mb-3"></div>
        <div className="h-4 bg-gray-100 rounded w-40"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-red-500">
        <h3 className="text-lg font-black text-red-700">⚠️ 결제 stuck 위젯 오류</h3>
        <p className="text-sm text-red-600 mt-2">{error}</p>
        <button
          onClick={load}
          className="mt-3 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600"
        >
          다시 시도
        </button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl shadow-xl p-6 border-l-4 border-emerald-500">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-emerald-800 flex items-center gap-2">
              <span className="text-2xl">✅</span>
              KISPG 결제 STUCK 감지
            </h3>
            <p className="text-sm text-emerald-700 mt-1 font-semibold">
              현재 정체된 결제 없음 (5분~24시간 PENDING 0건)
            </p>
          </div>
          {scannedAt && (
            <span className="text-xs text-emerald-600 font-medium">
              {new Date(scannedAt).toLocaleTimeString('ko-KR')} 검사
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl shadow-2xl p-6 border-l-4 border-red-500 ring-4 ring-red-100">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-black text-red-800 flex items-center gap-2">
            <span className="text-2xl animate-pulse">🚨</span>
            KISPG 결제 STUCK 감지 — {items.length}건
          </h3>
          <p className="text-sm text-red-700 mt-1 font-semibold">
            5분 이상 PENDING + 진입마커 + TID 없음. 즉시 확인 필요.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={load}
            className="px-3 py-1.5 bg-white text-red-700 rounded-lg text-xs font-bold border border-red-300 hover:bg-red-100"
          >
            🔄 재조회
          </button>
          {scannedAt && (
            <span className="text-xs text-red-600 font-medium">
              {new Date(scannedAt).toLocaleTimeString('ko-KR')}
            </span>
          )}
        </div>
      </div>

      {actionMsg && (
        <div className="mb-3 px-4 py-2 bg-white border border-red-200 rounded-lg text-sm font-semibold text-gray-800">
          {actionMsg}
        </div>
      )}

      <div className="space-y-3">
        {items.map((o) => (
          <div
            key={o.id}
            className="bg-white rounded-xl border border-red-200 p-4 shadow hover:shadow-md transition"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-gray-900">
                    {o.orderNumber}
                  </span>
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-bold">
                    {o.paymentMethod || 'unknown'}
                  </span>
                  {o.isGuest && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-bold">
                      비회원
                    </span>
                  )}
                  {o.ageMinutes != null && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">
                      {o.ageMinutes < 60
                        ? `${o.ageMinutes}분 경과`
                        : `${Math.floor(o.ageMinutes / 60)}시간 ${o.ageMinutes % 60}분 경과`}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-gray-700 flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    <span className="text-gray-500">주문자:</span>{' '}
                    <span className="font-semibold">{o.customerName || '-'}</span>
                  </span>
                  <span>
                    <span className="text-gray-500">연락처:</span>{' '}
                    <span className="font-mono">{o.customerPhone || '-'}</span>
                  </span>
                  <span>
                    <span className="text-gray-500">금액:</span>{' '}
                    <span className="font-bold text-blue-700">
                      ₩{o.total.toLocaleString()}
                    </span>
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  생성: {new Date(o.createdAt).toLocaleString('ko-KR')}
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-2">
                <a
                  href="https://admin.kispg.co.kr/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800 text-center"
                >
                  KISPG 콘솔 열기 ↗
                </a>
                <button
                  onClick={() => handleManualResolve(o)}
                  disabled={busyOrderId === o.id}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {busyOrderId === o.id ? '처리 중...' : 'TID 입력 → 복구'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-red-600 font-medium">
        ※ KISPG 콘솔에서 해당 주문번호로 TID 확인 → "TID 입력 → 복구" 버튼 클릭 → paymentKey 덮어쓰기 + CONFIRMED 처리.
      </p>
    </div>
  )
}
