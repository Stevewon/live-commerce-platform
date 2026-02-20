'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import ReviewForm from '@/components/ReviewForm';

interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  product: {
    id: string;
    name: string;
    slug: string;
    thumbnail: string;
    category: {
      name: string;
    };
  };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  subtotal: number;
  shippingFee: number;
  discount: number;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingZipCode: string | null;
  shippingMemo: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  review?: {
    id: string;
    rating: number;
  } | null;
}

export default function OrdersPage() {
  const { token, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<{orderId: string; productId: string; productName: string} | null>(null);

  // 인증 체크
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/partner/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user && token) {
      loadOrders();
    }
  }, [user, token]);

  useEffect(() => {
    if (filterStatus === 'all') {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter(order => order.status.toUpperCase() === filterStatus.toUpperCase()));
    }
  }, [filterStatus, orders]);

  const loadOrders = async () => {
    if (!token) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/orders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '주문 내역을 불러오는데 실패했습니다');
      }

      setOrders(data.orders || []);
      setFilteredOrders(data.orders || []);
    } catch (err: any) {
      console.error('Load orders error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (!token) return;
    if (!confirm('정말로 이 주문을 취소하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'CANCELLED' })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '주문 취소에 실패했습니다');
      }

      alert('주문이 취소되었습니다');
      loadOrders(); // 목록 새로고침
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      PENDING: '결제 대기',
      CONFIRMED: '주문 확인',
      SHIPPING: '배송 중',
      DELIVERED: '배송 완료',
      CANCELLED: '주문 취소',
      REFUNDED: '환불 완료',
    };
    return statusMap[status.toUpperCase()] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      PENDING: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
      CONFIRMED: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
      SHIPPING: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
      DELIVERED: 'text-green-400 bg-green-500/20 border-green-500/30',
      CANCELLED: 'text-red-400 bg-red-500/20 border-red-500/30',
      REFUNDED: 'text-gray-400 bg-gray-500/20 border-gray-500/30',
    };
    return colorMap[status.toUpperCase()] || 'text-gray-400 bg-gray-500/20 border-gray-500/30';
  };

  const statusCounts = {
    all: orders.length,
    PENDING: orders.filter(o => o.status === 'PENDING').length,
    CONFIRMED: orders.filter(o => o.status === 'CONFIRMED').length,
    SHIPPING: orders.filter(o => o.status === 'SHIPPING').length,
    DELIVERED: orders.filter(o => o.status === 'DELIVERED').length,
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400 text-xl">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 헤더 */}
      <header className="bg-gray-800/50 backdrop-blur-md border-b border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              Live Commerce
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/" className="text-gray-300 hover:text-white transition text-sm">
                홈
              </Link>
              <Link href="/shop" className="text-gray-300 hover:text-white transition text-sm">
                🛍️ 쇼핑몰
              </Link>
              <Link href="/my" className="text-blue-400 font-semibold text-sm">
                👤 마이페이지
              </Link>
              <Link href="/cart" className="relative text-gray-300 hover:text-white transition">
                <span className="text-2xl">🛒</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* 페이지 제목 */}
        <div className="mb-8">
          <Link href="/my" className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block">
            ← 마이페이지로 돌아가기
          </Link>
          <h1 className="text-4xl font-bold mb-2">📦 주문 내역</h1>
          <p className="text-gray-400 text-lg">
            총 <span className="text-blue-400 font-bold">{orders.length}</span>개의 주문
          </p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-xl p-4">
            <p className="text-red-400">{error}</p>
            <button 
              onClick={loadOrders}
              className="mt-2 text-sm text-red-300 hover:text-red-200 underline"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 상태 필터 */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              전체 ({statusCounts.all})
            </button>
            <button
              onClick={() => setFilterStatus('PENDING')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                filterStatus === 'PENDING'
                  ? 'bg-yellow-600 text-white shadow-lg'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              결제 대기 ({statusCounts.PENDING})
            </button>
            <button
              onClick={() => setFilterStatus('CONFIRMED')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                filterStatus === 'CONFIRMED'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              주문 확인 ({statusCounts.CONFIRMED})
            </button>
            <button
              onClick={() => setFilterStatus('SHIPPING')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                filterStatus === 'SHIPPING'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              배송 중 ({statusCounts.SHIPPING})
            </button>
            <button
              onClick={() => setFilterStatus('DELIVERED')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                filterStatus === 'DELIVERED'
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              배송 완료 ({statusCounts.DELIVERED})
            </button>
          </div>
        </div>

        {/* 주문 내역이 없을 때 */}
        {filteredOrders.length === 0 && (
          <div className="text-center py-24">
            <div className="text-8xl mb-6">📦</div>
            <h2 className="text-3xl font-bold text-white mb-4">주문 내역이 없습니다</h2>
            <p className="text-gray-400 text-lg mb-8">
              {filterStatus === 'all' 
                ? '첫 주문을 시작해보세요!' 
                : `${getStatusText(filterStatus)} 상태의 주문이 없습니다.`
              }
            </p>
            <Link
              href="/shop"
              className="inline-block px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg"
            >
              쇼핑하러 가기 →
            </Link>
          </div>
        )}

        {/* 주문 목록 */}
        {filteredOrders.length > 0 && (
          <div className="space-y-6">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden hover:border-blue-500/50 transition-all"
              >
                {/* 주문 헤더 */}
                <div className="bg-gray-800/80 p-6 border-b border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">주문번호</div>
                      <div className="text-lg font-bold text-white">{order.orderNumber}</div>
                    </div>
                    <div className={`px-4 py-2 rounded-full text-sm font-semibold border ${getStatusColor(order.status)}`}>
                      {getStatusText(order.status)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>주문일: {new Date(order.createdAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                    <div className="flex gap-2">
                      {/* 리뷰 작성 버튼 */}
                      {order.status === 'DELIVERED' && !order.review && order.items.length > 0 && (
                        <button
                          onClick={() => {
                            setSelectedOrder({
                              orderId: order.id,
                              productId: order.items[0].productId,
                              productName: order.items[0].product.name
                            });
                            setShowReviewForm(true);
                          }}
                          className="px-4 py-2 text-sm bg-purple-500/20 text-purple-400 border border-purple-500/50 rounded-lg hover:bg-purple-500/30 transition"
                        >
                          리뷰 작성
                        </button>
                      )}
                      {/* 주문 취소 버튼 */}
                      {(order.status === 'PENDING' || order.status === 'CONFIRMED') && (
                        <button
                          onClick={() => cancelOrder(order.id)}
                          className="px-4 py-2 text-sm bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition"
                        >
                          주문 취소
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 주문 상품 */}
                <div className="p-6">
                  <div className="space-y-4 mb-6">
                    {order.items.map((item) => (
                      <Link
                        key={item.id}
                        href={`/products/${item.product.slug}`}
                        className="flex items-center gap-4 p-4 rounded-xl bg-gray-700/30 hover:bg-gray-700/50 transition group"
                      >
                        <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                          <img
                            src={item.product.thumbnail}
                            alt={item.product.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition">
                            {item.product.name}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span>수량: {item.quantity}개</span>
                            <span>•</span>
                            <span className="text-blue-400 font-semibold">₩{item.price.toLocaleString()}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* 배송 정보 */}
                  <div className="bg-gray-700/30 rounded-xl p-4 mb-4">
                    <div className="text-sm font-semibold text-gray-300 mb-2">배송 정보</div>
                    <div className="text-sm text-gray-400 space-y-1">
                      <div>받는 사람: {order.shippingName}</div>
                      <div>연락처: {order.shippingPhone}</div>
                      <div>주소: {order.shippingZipCode ? `(${order.shippingZipCode}) ` : ''}{order.shippingAddress}</div>
                      {order.shippingMemo && <div>배송 메모: {order.shippingMemo}</div>}
                    </div>
                  </div>

                  {/* 결제 정보 */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                    <div className="text-sm text-gray-400">
                      결제 방법: <span className="text-white font-semibold">{order.paymentMethod || '미선택'}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400 mb-1">총 결제금액</div>
                      <div className="text-2xl font-bold text-blue-400">
                        ₩{order.total.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 리뷰 작성 모달 */}
      {showReviewForm && selectedOrder && (
        <ReviewForm
          orderId={selectedOrder.orderId}
          productId={selectedOrder.productId}
          productName={selectedOrder.productName}
          onSuccess={() => {
            setShowReviewForm(false);
            setSelectedOrder(null);
            loadOrders(); // 주문 목록 새로고침
          }}
          onCancel={() => {
            setShowReviewForm(false);
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
}
