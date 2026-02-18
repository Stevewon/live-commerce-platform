'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getOrders, createSampleOrders } from '@/lib/utils/orders';
import { getWishlistCount } from '@/lib/utils/wishlist';

export default function MyPage() {
  const [orderCount, setOrderCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
    
    // 샘플 데이터 생성 (테스트용 - 한 번만 실행)
    const hasOrders = localStorage.getItem('live-commerce-orders');
    if (!hasOrders) {
      createSampleOrders();
      loadData();
    }
    
    // 이벤트 리스너
    const handleUpdate = () => loadData();
    window.addEventListener('ordersUpdated', handleUpdate);
    window.addEventListener('wishlistUpdated', handleUpdate);
    
    return () => {
      window.removeEventListener('ordersUpdated', handleUpdate);
      window.removeEventListener('wishlistUpdated', handleUpdate);
    };
  }, []);

  const loadData = () => {
    setIsLoading(true);
    const orders = getOrders();
    setOrderCount(orders.length);
    setRecentOrders(orders.slice(0, 3)); // 최근 3개만
    setWishlistCount(getWishlistCount());
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
      pending: 'text-yellow-400 bg-yellow-500/20',
      confirmed: 'text-blue-400 bg-blue-500/20',
      shipping: 'text-purple-400 bg-purple-500/20',
      delivered: 'text-green-400 bg-green-500/20',
      cancelled: 'text-red-400 bg-red-500/20',
    };
    return colorMap[status] || 'text-gray-400 bg-gray-500/20';
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
      {/* 헤더 - 모바일 최적화 */}
      <header className="bg-gray-800/50 backdrop-blur-md border-b border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              Live Commerce
            </Link>
            <div className="flex items-center gap-3 sm:gap-6">
              <Link href="/" className="hidden sm:block text-gray-300 hover:text-white transition text-sm">
                홈
              </Link>
              <Link href="/shop" className="text-gray-300 hover:text-white transition text-xs sm:text-sm font-semibold">
                🛍️ 쇼핑몰
              </Link>
              <Link href="/my" className="text-blue-400 font-semibold text-xs sm:text-sm">
                👤 마이페이지
              </Link>
              <Link href="/cart" className="relative text-gray-300 hover:text-white transition">
                <span className="text-xl sm:text-2xl">🛒</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* 페이지 제목 - 모바일 최적화 */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">👤 마이페이지</h1>
          <p className="text-gray-400 text-sm sm:text-base lg:text-lg">주문 내역, 찜 목록, 회원 정보를 관리하세요</p>
        </div>

        {/* 대시보드 카드 - 모바일 최적화 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
          {/* 주문 내역 */}
          <Link href="/my/orders" className="group">
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border-2 border-blue-500/30 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:border-blue-500 transition-all transform hover:scale-105 hover:shadow-xl hover:shadow-blue-500/20">
              <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">📦</div>
              <h2 className="text-xl sm:text-2xl font-bold mb-2 group-hover:text-blue-400 transition">주문 내역</h2>
              <p className="text-gray-400 mb-3 sm:mb-4 text-sm sm:text-base">나의 구매 내역 확인</p>
              <div className="text-3xl sm:text-4xl font-bold text-blue-400">{orderCount}개</div>
            </div>
          </Link>

          {/* 찜 목록 */}
          <Link href="/wishlist" className="group">
            <div className="bg-gradient-to-br from-pink-600/20 to-purple-800/20 border-2 border-pink-500/30 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:border-pink-500 transition-all transform hover:scale-105 hover:shadow-xl hover:shadow-pink-500/20">
              <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">💖</div>
              <h2 className="text-xl sm:text-2xl font-bold mb-2 group-hover:text-pink-400 transition">찜 목록</h2>
              <p className="text-gray-400 mb-3 sm:mb-4 text-sm sm:text-base">관심 상품 모음</p>
              <div className="text-3xl sm:text-4xl font-bold text-pink-400">{wishlistCount}개</div>
            </div>
          </Link>

          {/* 회원 정보 */}
          <Link href="/my/profile" className="group sm:col-span-2 md:col-span-1">
            <div className="bg-gradient-to-br from-purple-600/20 to-indigo-800/20 border-2 border-purple-500/30 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:border-purple-500 transition-all transform hover:scale-105 hover:shadow-xl hover:shadow-purple-500/20">
              <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">⚙️</div>
              <h2 className="text-xl sm:text-2xl font-bold mb-2 group-hover:text-purple-400 transition">회원 정보</h2>
              <p className="text-gray-400 mb-3 sm:mb-4 text-sm sm:text-base">프로필 및 설정 관리</p>
              <div className="text-base sm:text-lg font-semibold text-purple-400">설정하기 →</div>
            </div>
          </Link>
        </div>

        {/* 최근 주문 내역 - 모바일 최적화 */}
        <div className="mb-8 sm:mb-12">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold">최근 주문 내역</h2>
            <Link href="/my/orders" className="text-blue-400 hover:text-blue-300 transition text-xs sm:text-sm font-semibold">
              전체보기 →
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="bg-gray-800/50 rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center border border-gray-700">
              <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">📦</div>
              <p className="text-gray-400 text-base sm:text-lg mb-3 sm:mb-4">주문 내역이 없습니다</p>
              <Link
                href="/shop"
                className="inline-block px-5 sm:px-6 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition text-sm sm:text-base"
              >
                쇼핑하러 가기
              </Link>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/my/orders`}
                  className="block bg-gray-800/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-gray-700 hover:border-blue-500 transition-all"
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between mb-3 sm:mb-4 gap-2 sm:gap-0">
                    <div>
                      <div className="text-xs sm:text-sm text-gray-400 mb-1">주문번호: {order.orderNumber}</div>
                      <div className="text-xs sm:text-sm text-gray-400">
                        {new Date(order.orderedAt).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                    <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold ${getStatusColor(order.status)}`}>
                      {getStatusText(order.status)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4 overflow-x-auto">
                    {order.items.slice(0, 3).map((item: any, idx: number) => (
                      <div key={idx} className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                        <img
                          src={item.productImage}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <div className="text-gray-400 text-xs sm:text-sm flex-shrink-0">외 {order.items.length - 3}개</div>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-gray-400 text-xs sm:text-sm">총 결제금액: </span>
                    <span className="text-lg sm:text-xl font-bold text-blue-400">
                      ₩{order.totalAmount.toLocaleString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 빠른 링크 - 모바일 최적화 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Link
            href="/my/orders"
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 sm:p-6 text-center hover:border-blue-500 transition group"
          >
            <div className="text-3xl sm:text-4xl mb-1 sm:mb-2">📦</div>
            <div className="text-xs sm:text-sm font-semibold group-hover:text-blue-400 transition">전체 주문</div>
          </Link>
          <Link
            href="/wishlist"
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 sm:p-6 text-center hover:border-pink-500 transition group"
          >
            <div className="text-3xl sm:text-4xl mb-1 sm:mb-2">💖</div>
            <div className="text-xs sm:text-sm font-semibold group-hover:text-pink-400 transition">찜한 상품</div>
          </Link>
          <Link
            href="/my/profile"
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 sm:p-6 text-center hover:border-purple-500 transition group"
          >
            <div className="text-3xl sm:text-4xl mb-1 sm:mb-2">⚙️</div>
            <div className="text-xs sm:text-sm font-semibold group-hover:text-purple-400 transition">내 정보</div>
          </Link>
          <Link
            href="/shop"
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 sm:p-6 text-center hover:border-green-500 transition group"
          >
            <div className="text-3xl sm:text-4xl mb-1 sm:mb-2">🛍️</div>
            <div className="text-xs sm:text-sm font-semibold group-hover:text-green-400 transition">쇼핑하기</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
