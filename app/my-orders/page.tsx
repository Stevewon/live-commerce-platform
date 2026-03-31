'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import ShopNavigation from '@/components/ShopNavigation';
import { ORDER_STATUS_MAP } from '@/lib/utils/courier';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  product: {
    id: string;
    name: string;
    thumbnail: string;
    slug: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  createdAt: string;
  trackingCompany: string | null;
  trackingNumber: string | null;
  items: OrderItem[];
}

export default function MyOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login?redirect=/my-orders');
      return;
    }
    fetchOrders();
  }, [user, authLoading]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || data.data || []);
      }
    } catch (err) {
      console.error('주문 목록 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (orderId: string) => {
    if (!confirm('주문을 취소하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      if (res.ok) {
        fetchOrders();
      } else {
        const data = await res.json();
        alert(data.error || '주문 취소 실패');
      }
    } catch {
      alert('주문 취소 중 오류가 발생했습니다.');
    }
  };

  const filteredOrders = statusFilter === 'ALL'
    ? orders
    : orders.filter(o => o.status === statusFilter);

  const statusTabs = [
    { value: 'ALL', label: '전체' },
    { value: 'PENDING', label: '주문대기' },
    { value: 'CONFIRMED', label: '확인됨' },
    { value: 'SHIPPING', label: '배송중' },
    { value: 'DELIVERED', label: '배송완료' },
    { value: 'CANCELLED', label: '취소/환불' },
  ];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ShopNavigation />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">주문 내역을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      <ShopNavigation />
      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">주문 내역</h1>

        {/* Status filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 -mx-4 px-4">
          {statusTabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
                statusFilter === tab.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {tab.value !== 'ALL' && (
                <span className="ml-1 text-xs opacity-70">
                  ({orders.filter(o => tab.value === 'CANCELLED' ? (o.status === 'CANCELLED' || o.status === 'REFUNDED') : o.status === tab.value).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Order list */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <span className="text-6xl block mb-4">📦</span>
            <h2 className="text-xl font-bold text-gray-900 mb-2">주문 내역이 없습니다</h2>
            <p className="text-gray-500 mb-6">아직 주문한 상품이 없습니다.</p>
            <Link href="/products" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition">
              쇼핑하러 가기
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map(order => {
              const statusInfo = ORDER_STATUS_MAP[order.status] || ORDER_STATUS_MAP.PENDING;
              const canCancel = order.status === 'PENDING' || order.status === 'CONFIRMED';

              return (
                <div key={order.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {/* Order header */}
                  <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-gray-50 border-b">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                      <span className="text-xs text-gray-400">|</span>
                      <span className="text-sm font-mono text-gray-500">{order.orderNumber}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusInfo.color} ${statusInfo.bgColor}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Order items */}
                  <div className="px-4 sm:px-6 py-4">
                    {order.items.map(item => (
                      <div key={item.id} className="flex gap-4 py-2">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          <img
                            src={item.product.thumbnail}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                            onError={e => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-2xl">📦</div>';
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link href={`/products/${item.product.slug}`} className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-1">
                            {item.product.name}
                          </Link>
                          <p className="text-sm text-gray-500">₩{item.price.toLocaleString()} x {item.quantity}개</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tracking info */}
                  {order.trackingCompany && order.trackingNumber && (
                    <div className="px-4 sm:px-6 py-3 bg-indigo-50 border-t border-indigo-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-indigo-600">🚚</span>
                          <span className="font-medium text-indigo-700">{order.trackingCompany}</span>
                          <span className="text-indigo-600 font-mono">{order.trackingNumber}</span>
                        </div>
                        <a
                          href={`https://trace.cjlogistics.com/web/detail.jsp?slipno=${order.trackingNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          배송추적 →
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Order footer */}
                  <div className="px-4 sm:px-6 py-3 border-t flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-500">총 결제금액</span>
                      <span className="ml-2 text-lg font-bold text-gray-900">₩{order.total.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/my-orders/${order.id}`}
                        className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                      >
                        상세보기
                      </Link>
                      {canCancel && (
                        <button
                          onClick={() => handleCancel(order.id)}
                          className="px-4 py-2 text-sm text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition"
                        >
                          주문취소
                        </button>
                      )}
                      {order.status === 'DELIVERED' && (
                        <Link
                          href={`/my-orders/${order.id}?review=true`}
                          className="px-4 py-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
                        >
                          리뷰작성
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
