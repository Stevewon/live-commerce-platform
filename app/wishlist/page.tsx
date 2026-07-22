'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { authFetch } from '@/lib/auth/clientFetch';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import ShopNavigation from '@/components/ShopNavigation';
import { proxyImg, thumbUrl } from '@/lib/utils/imgProxy';
import { useAutoTranslate } from '@/lib/i18n/useAutoTranslate';

interface ServerWishlistItem {
  id: string;
  productId: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    comparePrice?: number | null;
    thumbnail?: string | null;
    images?: string | null;
    category?: { name: string; slug: string } | null;
  };
}

export default function WishlistPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();

  const [items, setItems] = useState<ServerWishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // 상품명/카테고리 자동 번역
  const { tr } = useAutoTranslate(
    items.flatMap((it) => [it.product?.name, it.product?.category?.name]).filter(Boolean) as string[]
  );

  // 인증 게이트
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?redirect=/wishlist');
    }
  }, [user, authLoading, router]);

  // 서버에서 위시리스트 로드
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    loadWishlist();
  }, [user, authLoading]);

  const loadWishlist = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/wishlist');
      if (!res.ok) {
        setError('찜 목록을 불러오지 못했습니다.');
        setItems([]);
        return;
      }
      const data = await res.json();
      setItems(data.data || []);
    } catch (err) {
      console.error('위시리스트 로드 실패:', err);
      setError('네트워크 오류로 찜 목록을 불러오지 못했습니다.');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (productId: string) => {
    // 낙관적 UI 업데이트
    const prev = items;
    setItems(items.filter((it) => it.productId !== productId));
    try {
      const res = await authFetch(`/api/wishlist?productId=${encodeURIComponent(productId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        // 실패 시 롤백
        setItems(prev);
        alert('찜 목록에서 제거하지 못했습니다.');
      } else {
        // 다른 페이지(네비/뱃지)에서 동기화하도록 이벤트 발행
        try {
          window.dispatchEvent(new Event('wishlistUpdated'));
        } catch {}
      }
    } catch (err) {
      console.error('위시리스트 삭제 실패:', err);
      setItems(prev);
      alert('네트워크 오류로 제거에 실패했습니다.');
    }
  };

  const handleClearAll = async () => {
    if (items.length === 0) return;
    if (!confirm('찜 목록을 모두 삭제하시겠습니까?')) return;
    // 병렬 삭제
    const prev = items;
    setItems([]);
    try {
      await Promise.all(
        prev.map((it) =>
          authFetch(`/api/wishlist?productId=${encodeURIComponent(it.productId)}`, {
            method: 'DELETE',
          })
        )
      );
      try {
        window.dispatchEvent(new Event('wishlistUpdated'));
      } catch {}
    } catch (err) {
      console.error('위시리스트 전체 삭제 실패:', err);
      // 실패 시 다시 로드
      loadWishlist();
    }
  };

  const getThumbnail = (item: ServerWishlistItem): string => {
    const p = item.product || ({} as any);
    if (p.thumbnail) return p.thumbnail;
    if (p.images) {
      try {
        const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images;
        if (Array.isArray(imgs) && imgs.length > 0) return imgs[0];
      } catch {}
    }
    return '';
  };

  const getDiscount = (item: ServerWishlistItem): number => {
    const p = item.product;
    if (!p?.comparePrice || !p.price) return 0;
    return Math.round(((p.comparePrice - p.price) / p.comparePrice) * 100);
  };

  // 인증 로딩 중 또는 미인증 → 로딩 스피너 (리다이렉트 진행 중)
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 text-base">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      <ShopNavigation />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
        {/* 페이지 제목 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              💖 {t.wishlist.title}
            </h1>
            <p className="text-gray-500 text-sm sm:text-base lg:text-lg">
              총 <span className="text-pink-600 font-bold">{items.length}</span>개의 상품
            </p>
          </div>
          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-white border border-red-200 text-red-600 rounded-xl hover:bg-red-50 hover:border-red-400 transition font-semibold text-sm sm:text-base self-end sm:self-auto"
            >
              {t.common.delete}
            </button>
          )}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 로딩 */}
        {isLoading ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-3"></div>
            <p className="text-gray-500">로딩 중...</p>
          </div>
        ) : items.length === 0 ? (
          /* 비어있을 때 */
          <div className="bg-white rounded-2xl text-center py-16 sm:py-24 border border-gray-200">
            <div className="text-6xl sm:text-8xl mb-4 sm:mb-6">💔</div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
              {t.wishlist.empty}
            </h2>
            <p className="text-gray-500 text-sm sm:text-base mb-6 sm:mb-8 px-4">
              {t.wishlist.goShopping}
            </p>
            <Link
              href="/products"
              className="inline-block px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-xl font-bold text-base sm:text-lg transition-all shadow-lg"
            >
              {t.wishlist.goShopping} →
            </Link>
          </div>
        ) : (
          <>
            {/* 찜 목록 그리드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {items.map((item) => {
                const p = item.product;
                if (!p) return null;
                const thumb = getThumbnail(item);
                const discount = getDiscount(item);
                return (
                  <div
                    key={item.id}
                    className="group bg-white rounded-2xl overflow-hidden border border-gray-200 hover:border-pink-500 hover:shadow-lg transition-all duration-300 relative"
                  >
                    {/* 삭제 버튼 */}
                    <button
                      onClick={() => handleRemove(item.productId)}
                      className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 flex items-center justify-center hover:bg-red-50 hover:border-red-400 transition-all shadow-sm"
                      title="찜 목록에서 제거"
                      aria-label="찜 목록에서 제거"
                    >
                      <span className="text-red-500 text-lg">✕</span>
                    </button>

                    <Link href={`/products/${p.slug}`} className="block">
                      <div className="relative aspect-square overflow-hidden bg-gray-100">
                        {thumb ? (
                          <img
                            src={thumbUrl(thumb, 300)}
                            alt={p.name}
                            loading="lazy"
                            width={400}
                            height={400}
                            sizes="(max-width: 640px) 50vw, 200px"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement!.innerHTML =
                                '<div class="w-full h-full flex items-center justify-center text-5xl">📦</div>';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-5xl">
                            📦
                          </div>
                        )}
                        {discount > 0 && (
                          <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                            {discount}% OFF
                          </div>
                        )}
                      </div>

                      <div className="p-4 sm:p-5">
                        {p.category?.name && (
                          <div className="mb-2">
                            <span className="bg-pink-50 text-pink-600 text-xs px-2 py-1 rounded">
                              {tr(p.category.name)}
                            </span>
                          </div>
                        )}

                        <h3 className="text-gray-900 font-bold text-base sm:text-lg mb-2 sm:mb-3 group-hover:text-pink-600 transition-colors line-clamp-2 min-h-[2.5rem] sm:min-h-[3.5rem]">
                          {tr(p.name)}
                        </h3>

                        <div className="flex items-baseline gap-2 mb-3">
                          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-pink-600">
                            ₩{p.price.toLocaleString()}
                          </p>
                          {p.comparePrice && p.comparePrice > p.price && (
                            <p className="text-xs sm:text-sm text-gray-400 line-through">
                              ₩{p.comparePrice.toLocaleString()}
                            </p>
                          )}
                        </div>

                        <div className="text-[11px] text-gray-400 mb-3">
                          {new Date(item.createdAt).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}{' '}
                          찜함
                        </div>

                        <div className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-pink-500 to-purple-500 group-hover:from-pink-600 group-hover:to-purple-600 text-white rounded-xl font-semibold transition-all text-center text-sm sm:text-base">
                          상품 보기 →
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* 쇼핑 계속하기 버튼 */}
            <div className="text-center mt-10 sm:mt-12">
              <Link
                href="/products"
                className="inline-block px-6 sm:px-8 py-3 sm:py-4 bg-white border-2 border-gray-200 hover:border-pink-500 hover:shadow-md text-gray-700 hover:text-pink-600 rounded-xl font-bold text-base sm:text-lg transition-all"
              >
                {t.cart.continueShopping} 🛍️
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
