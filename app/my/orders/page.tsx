'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getOrders, type Order } from '@/lib/utils/orders';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOrders();
    
    const handleUpdate = () => loadOrders();
    window.addEventListener('ordersUpdated', handleUpdate);
    
    return () => {
      window.removeEventListener('ordersUpdated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (filterStatus === 'all') {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter(order => order.status === filterStatus));
    }
  }, [filterStatus, orders]);

  const loadOrders = () => {
    setIsLoading(true);
    const allOrders = getOrders();
    setOrders(allOrders);
    setFilteredOrders(allOrders);
    setIsLoading(false);
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      pending: '결제 대기',
      confirmed: '주문 확인',
      shipping: '배송 중',
      delivered: '배송 완료',
      cancelled: '주문 취소',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      pending: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
      confirmed: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
      shipping: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
      delivered: 'text-green-400 bg-green-500/20 border-green-500/30',
      cancelled: 'text-red-400 bg-red-500/20 border-red-500/30',
    };
    return colorMap[status] || 'text-gray-400 bg-gray-500/20 border-gray-500/30';
  };

  const statusCounts = {
    all: orders.length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    shipping: orders.filter(o => o.status === 'shipping').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  };

  if (isLoading) {
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
              onClick={() => setFilterStatus('confirmed')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                filterStatus === 'confirmed'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              주문 확인 ({statusCounts.confirmed})
            </button>
            <button
              onClick={() => setFilterStatus('shipping')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                filterStatus === 'shipping'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              배송 중 ({statusCounts.shipping})
            </button>
            <button
              onClick={() => setFilterStatus('delivered')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                filterStatus === 'delivered'
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              배송 완료 ({statusCounts.delivered})
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
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>주문일: {new Date(order.orderedAt).toLocaleDateString('ko-KR')}</span>
                    {order.deliveredAt && (
                      <span>배송완료: {new Date(order.deliveredAt).toLocaleDateString('ko-KR')}</span>
                    )}
                  </div>
                </div>

                {/* 주문 상품 */}
                <div className="p-6">
                  <div className="space-y-4 mb-6">
                    {order.items.map((item, idx) => (
                      <Link
                        key={idx}
                        href={`/products/${item.productSlug}`}
                        className="flex items-center gap-4 p-4 rounded-xl bg-gray-700/30 hover:bg-gray-700/50 transition group"
                      >
                        <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                          <img
                            src={item.productImage}
                            alt={item.productName}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition">
                            {item.productName}
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
                      <div>받는 사람: {order.shippingAddress.name}</div>
                      <div>연락처: {order.shippingAddress.phone}</div>
                      <div>주소: ({order.shippingAddress.zipCode}) {order.shippingAddress.address}</div>
                    </div>
                  </div>

                  {/* 결제 정보 */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                    <div className="text-sm text-gray-400">
                      결제 방법: <span className="text-white font-semibold">{order.paymentMethod}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400 mb-1">총 결제금액</div>
                      <div className="text-2xl font-bold text-blue-400">
                        ₩{order.totalAmount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
