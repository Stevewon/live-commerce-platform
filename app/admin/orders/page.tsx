'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Order {
  id: string
  orderNumber: string
  total: number
  partnerRevenue: number
  platformRevenue: number
  status: string
  createdAt: string
  paidAt: string | null
  user: {
    name: string
    email: string
    phone: string
  }
  partner: {
    storeName: string
    storeSlug: string
  }
  items: {
    id: string
    quantity: number
    price: number
    product: {
      name: string
    }
  }[]
  shippingAddress: string
}

export default function AdminOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    
    if (!token || !userStr) {
      router.push('/admin/login')
      return
    }

    const userData = JSON.parse(userStr)
    if (userData.role !== 'ADMIN') {
      router.push('/admin/login')
      return
    }

    loadOrders(token)
  }, [router])

  const loadOrders = async (token: string) => {
    try {
      const res = await fetch('/api/admin/orders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!res.ok) throw new Error('주문 로드 실패')

      const data = await res.json()
      setOrders(data.orders)
    } catch (err) {
      console.error('Orders load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const token = localStorage.getItem('token')
    if (!token) return

    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (res.ok) {
        loadOrders(token)
      }
    } catch (err) {
      console.error('Status update error:', err)
    }
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
      REFUNDED: 'bg-gray-100 text-gray-800',
    }
    
    const labels: Record<string, string> = {
      PENDING: '대기중',
      CONFIRMED: '확인됨',
      SHIPPING: '배송중',
      DELIVERED: '배송완료',
      CANCELLED: '취소됨',
      REFUNDED: '환불됨',
    }

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    )
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.user.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus
    
    return matchesSearch && matchesStatus
  })

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
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/admin/dashboard" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
                ← 대시보드로 돌아가기
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">주문 관리</h1>
              <p className="text-sm text-gray-600">플랫폼의 모든 주문을 관리하세요</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="card mb-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="label">검색</label>
              <input
                type="text"
                className="input"
                placeholder="주문번호 또는 고객명..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <label className="label">주문 상태</label>
              <select
                className="input"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">전체</option>
                <option value="PENDING">대기중</option>
                <option value="CONFIRMED">확인됨</option>
                <option value="SHIPPING">배송중</option>
                <option value="DELIVERED">배송완료</option>
                <option value="CANCELLED">취소됨</option>
                <option value="REFUNDED">환불됨</option>
              </select>
            </div>

            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                총 <span className="font-bold text-gray-900">{filteredOrders.length}</span>건 주문
              </div>
            </div>
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-gray-600">주문이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div key={order.id} className="card hover:shadow-lg transition-shadow">
                <div className="flex flex-wrap gap-4 justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg font-mono">{order.orderNumber}</h3>
                    <p className="text-sm text-gray-600">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-4">
                  {/* 고객 정보 */}
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">고객 정보</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-600">이름:</span> {order.user.name}</p>
                      <p><span className="text-gray-600">이메일:</span> {order.user.email}</p>
                      <p><span className="text-gray-600">연락처:</span> {order.user.phone}</p>
                    </div>
                  </div>

                  {/* 파트너 정보 */}
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">파트너 정보</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-600">상점:</span> {order.partner.storeName}</p>
                      <p><span className="text-gray-600">URL:</span> /{order.partner.storeSlug}</p>
                    </div>
                  </div>
                </div>

                {/* 주문 상품 */}
                <div className="mb-4">
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">주문 상품</h4>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.product.name} x {item.quantity}</span>
                        <span className="font-semibold">{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 금액 정보 */}
                <div className="border-t pt-4 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">주문 금액</span>
                    <span className="text-lg font-bold text-gray-900">{formatCurrency(order.total)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">파트너 수익</span>
                    <span className="font-semibold text-green-600">{formatCurrency(order.partnerRevenue)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">플랫폼 수익</span>
                    <span className="font-semibold text-blue-600">{formatCurrency(order.platformRevenue)}</span>
                  </div>
                </div>

                {/* 배송 정보 */}
                <div className="bg-blue-50 rounded-lg p-3 mb-4">
                  <h4 className="font-semibold text-sm text-gray-700 mb-1">배송 주소</h4>
                  <p className="text-sm text-gray-700">{order.shippingAddress}</p>
                </div>

                {/* 액션 버튼 */}
                {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                  <div className="flex gap-2 flex-wrap">
                    {order.status === 'PENDING' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'CONFIRMED')}
                        className="btn btn-primary text-sm"
                      >
                        주문 확인
                      </button>
                    )}
                    {order.status === 'CONFIRMED' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'SHIPPING')}
                        className="btn btn-primary text-sm"
                      >
                        배송 시작
                      </button>
                    )}
                    {order.status === 'SHIPPING' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'DELIVERED')}
                        className="btn btn-primary text-sm"
                      >
                        배송 완료
                      </button>
                    )}
                    <button
                      onClick={() => updateOrderStatus(order.id, 'CANCELLED')}
                      className="btn btn-secondary text-sm"
                    >
                      주문 취소
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
