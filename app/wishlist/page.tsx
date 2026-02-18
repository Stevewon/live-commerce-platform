'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getWishlist, removeFromWishlist, clearWishlist, type WishlistItem } from '@/lib/utils/wishlist';

export default function WishlistPage() {
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 찜 목록 로드
  useEffect(() => {
    loadWishlist();
    
    // wishlist 업데이트 이벤트 리스너
    const handleWishlistUpdate = () => {
      loadWishlist();
    };
    
    window.addEventListener('wishlistUpdated', handleWishlistUpdate);
    
    return () => {
      window.removeEventListener('wishlistUpdated', handleWishlistUpdate);
    };
  }, []);

  const loadWishlist = () => {
    setIsLoading(true);
    const items = getWishlist();
    setWishlistItems(items);
    setIsLoading(false);
  };

  const handleRemove = (itemId: string) => {
    removeFromWishlist(itemId);
  };

  const handleClearAll = () => {
    if (confirm('찜한 모든 상품을 삭제하시겠습니까?')) {
      clearWishlist();
    }
  };

  const discount = (item: WishlistItem) =>
    item.comparePrice
      ? Math.round(((item.comparePrice - item.price) / item.comparePrice) * 100)
      : 0;

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
              <Link href="/shop" className="text-gray-300 hover:text-white transition text-xs sm:text-sm">
                🛍️ 쇼핑몰
              </Link>
              <Link href="/wishlist" className="text-pink-400 font-semibold text-xs sm:text-sm">
                💖 찜목록
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">💖 찜한 상품</h1>
            <p className="text-gray-400 text-base sm:text-lg">
              총 <span className="text-pink-400 font-bold">{wishlistItems.length}</span>개의 상품
            </p>
          </div>
          {wishlistItems.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-red-600/20 border border-red-500 text-red-400 rounded-xl hover:bg-red-600/30 transition font-semibold text-sm sm:text-base self-end sm:self-auto"
            >
              전체 삭제
            </button>
          )}
        </div>

        {/* 찜 목록이 비어있을 때 */}
        {wishlistItems.length === 0 && (
          <div className="text-center py-16 sm:py-24">
            <div className="text-6xl sm:text-8xl mb-4 sm:mb-6">💔</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">찜한 상품이 없습니다</h2>
            <p className="text-gray-400 text-base sm:text-lg mb-6 sm:mb-8">
              마음에 드는 상품을 찜해보세요!
            </p>
            <Link
              href="/shop"
              className="inline-block px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-xl font-bold text-base sm:text-lg transition-all transform hover:scale-105 shadow-lg"
            >
              쇼핑하러 가기 →
            </Link>
          </div>
        )}

        {/* 찜 목록 그리드 */}
        {wishlistItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {wishlistItems.map((item) => (
              <div
                key={item.id}
                className="group bg-gray-800/50 rounded-2xl overflow-hidden border border-gray-700 hover:border-pink-500 transition-all duration-300 relative"
              >
                {/* 삭제 버튼 */}
                <button
                  onClick={() => handleRemove(item.id)}
                  className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-red-600/80 backdrop-blur-sm flex items-center justify-center hover:bg-red-600 transition-all transform hover:scale-110"
                  title="찜 목록에서 제거"
                >
                  <span className="text-white text-xl">✕</span>
                </button>

                <Link href={`/products/${item.slug}`} className="block">
                  <div className="relative aspect-square overflow-hidden bg-gray-700">
                    <img
                      src={item.thumbnail}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    {discount(item) > 0 && (
                      <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                        {discount(item)}% OFF
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg text-white text-xs">
                        {new Date(item.addedAt).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })} 찜함
                      </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="bg-pink-500/20 text-pink-400 text-xs px-2 py-1 rounded">
                        {item.category}
                      </span>
                      <span className="text-pink-400 text-base sm:text-lg">💖</span>
                    </div>

                    <h3 className="text-white font-bold text-lg mb-3 group-hover:text-pink-400 transition-colors line-clamp-2">
                      {item.name}
                    </h3>

                    <div className="flex items-baseline gap-2 mb-3">
                      <p className="text-lg sm:text-xl lg:text-2xl font-bold text-pink-400">₩{item.price.toLocaleString()}</p>
                      {item.comparePrice && (
                        <p className="text-xs sm:text-sm text-gray-500 line-through">₩{item.comparePrice.toLocaleString()}</p>
                      )}
                    </div>

                    <button
                      className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-xl font-semibold transition-all transform hover:scale-105"
                    >
                      상세보기 →
                    </button>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* 쇼핑 계속하기 버튼 */}
        {wishlistItems.length > 0 && (
          <div className="text-center mt-12">
            <Link
              href="/shop"
              className="inline-block px-8 py-4 bg-gray-800/50 border-2 border-gray-700 hover:border-pink-500 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-105"
            >
              쇼핑 계속하기 🛍️
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
