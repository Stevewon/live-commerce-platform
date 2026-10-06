'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { authFetch } from '@/lib/auth/clientFetch';
import ShopNavigation from '@/components/ShopNavigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAutoTranslate } from '@/lib/i18n/useAutoTranslate';
import { proxyImg, thumbUrl } from '@/lib/utils/imgProxy';
import {
  getGuestCart,
  updateGuestCartQuantity,
  removeFromGuestCart,
  clearGuestCart,
  GuestCartItem,
} from '@/lib/utils/guestCart';
import { buildOptionLabel } from '@/lib/utils/optionLabel';
import { getBundleSize, bundlePiecePrice } from '@/lib/utils/bundle';

interface CartItem {
  id: string;
  productId: string;
  variantId?: string | null;    // [옵션] 같은 상품이라도 옵션별로 별도 행
  optionLabel?: string | null;  // [옵션] "색상: 핑크 / 사이즈: M"
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    comparePrice?: number | null;
    stock: number;
    thumbnail: string;
    category?: { name: string; slug: string };
  };
}

export default function CartPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  // 쿠팡식 선택결제: 선택된 상품 productId 집합
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { t } = useLanguage();
  const { tr } = useAutoTranslate(
    cartItems.flatMap((it) => [it.product?.name, it.product?.category?.name]).filter(Boolean) as string[]
  );

  // 동적 배송비 설정
  const [shippingConfig, setShippingConfig] = useState({ shippingFee: 3000, freeShippingThreshold: 50000 });

  useEffect(() => {
    fetch('/api/settings/shipping')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setShippingConfig(data.data);
        }
      })
      .catch(() => {});
  }, []);

  const isGuest = !user;

  const loadCart = useCallback(async () => {
    if (authLoading) return;

    try {
      if (user) {
        // 회원: 서버 장바구니
        const res = await authFetch('/api/cart');
        if (res.ok) {
          const data = await res.json();
          const serverItems = (data.data || []).map((item: any) => ({
            id: item.id,
            productId: item.productId,
            variantId: item.variantId || item.variant?.id || null,
            optionLabel: buildOptionLabel(item.variant?.optionValues),
            quantity: item.quantity,
            product: {
              id: item.product?.id || item.productId,
              name: item.product?.name || '상품',
              slug: item.product?.slug || '',
              // [옵션] 옵션 가격/재고가 따로 있으면 그 값을 사용
              //   [1+1 묶음] 개별 1개 가격 = 세트가 / 구성개수 (서버 주문 금액과 동일)
              price: item.variant && getBundleSize(item.product?.name) > 1
                ? bundlePiecePrice(item.product?.price || 0, getBundleSize(item.product?.name))
                : (item.variant?.price ?? item.product?.price ?? 0),
              comparePrice: item.variant ? null : (item.product?.comparePrice || null),
              stock: item.variant?.stock ?? item.product?.stock ?? 0,
              thumbnail: item.product?.thumbnail || '',
              category: item.product?.category || null,
            },
          }));
          setCartItems(serverItems);
        }
      } else {
        // 비회원: localStorage 장바구니
        const guestItems = getGuestCart();
        const mapped: CartItem[] = guestItems.map((item) => ({
          id: `guest-${item.productId}-${item.variantId || 'none'}`,
          productId: item.productId,
          variantId: item.variantId || null,
          optionLabel: item.optionLabel || null,
          quantity: item.quantity,
          product: {
            id: item.product.id,
            name: item.product.name,
            slug: item.product.slug,
            price: item.product.price,
            comparePrice: item.product.comparePrice || null,
            stock: item.product.stock,
            thumbnail: item.product.thumbnail,
            category: item.product.category || undefined,
          },
        }));
        setCartItems(mapped);
      }
    } catch (error) {
      console.error('장바구니 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  // 장바구니 목록이 바뀌면 선택 상태를 정리한다.
  // - 신규 로드 시: 기본적으로 전체 선택
  // - 이미 선택되어 있던 항목은 유지, 사라진 항목은 제거
  useEffect(() => {
    setSelectedIds((prev) => {
      const currentIds = cartItems.map((it) => it.id);
      // 최초(비어있던 경우)에는 전체 선택
      if (prev.size === 0) {
        return new Set(currentIds);
      }
      // 존재하는 항목만 유지
      const next = new Set<string>();
      currentIds.forEach((id) => {
        if (prev.has(id)) next.add(id);
      });
      return next;
    });
    // cartItems 자체가 바뀔 때만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems.map((it) => it.id).join(',')]);

  // 선택은 장바구니 "행"(item.id) 단위 — 같은 상품의 핑크/블루 옵션을 각각 선택 가능
  const isSelected = (itemId: string) => selectedIds.has(itemId);

  const toggleSelect = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // 서버/게스트 장바구니에서 이 행만 삭제
  const deleteRow = async (item: CartItem) => {
    if (user) {
      return authFetch(`/api/cart?itemId=${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    }
    removeFromGuestCart(item.productId, item.variantId || null);
    return null;
  };

  const allSelected = cartItems.length > 0 && selectedIds.size === cartItems.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cartItems.map((it) => it.id)));
    }
  };

  // 선택된 상품 삭제
  const handleRemoveSelected = async () => {
    const targets = cartItems.filter((it) => selectedIds.has(it.id));
    if (targets.length === 0) return;
    if (!confirm(`선택한 ${targets.length}개 상품을 삭제할까요?`)) return;
    for (const item of targets) {
      try { await deleteRow(item); } catch {}
    }
    setCartItems((prev) => prev.filter((ci) => !selectedIds.has(ci.id)));
    setSelectedIds(new Set());
  };

  // 선택 상품만 결제 — 행 id 로 넘겨야 같은 상품의 옵션 중 선택한 것만 결제됨
  const handleCheckoutSelected = () => {
    const selectedItemIds = cartItems
      .filter((it) => selectedIds.has(it.id))
      .map((it) => it.id);
    if (selectedItemIds.length === 0) {
      alert('구매할 상품을 선택해주세요.');
      return;
    }
    try {
      sessionStorage.setItem('checkout_selectedItemIds', JSON.stringify(selectedItemIds));
      sessionStorage.removeItem('checkout_selectedProductIds');
    } catch {}
    router.push('/checkout?mode=selected');
  };

  // 비회원 장바구니 변경 이벤트 리스너
  useEffect(() => {
    const handleGuestCartUpdate = () => {
      if (!user) loadCart();
    };
    window.addEventListener('guestCartUpdated', handleGuestCartUpdate);
    return () => window.removeEventListener('guestCartUpdated', handleGuestCartUpdate);
  }, [user, loadCart]);

  const handleQuantityChange = async (item: CartItem, newQuantity: number) => {
    if (newQuantity < 1) return;
    setUpdatingId(item.id);
    try {
      if (user) {
        const res = await authFetch('/api/cart', {
          method: 'PATCH',
          body: JSON.stringify({ itemId: item.id, productId: item.productId, quantity: newQuantity }),
        });
        if (res.ok) {
          setCartItems(prev =>
            prev.map(ci => (ci.id === item.id ? { ...ci, quantity: newQuantity } : ci))
          );
        }
      } else {
        updateGuestCartQuantity(item.productId, newQuantity, item.variantId || null);
        setCartItems(prev =>
          prev.map(ci => (ci.id === item.id ? { ...ci, quantity: newQuantity } : ci))
        );
      }
    } catch (error) {
      console.error('수량 변경 실패:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemoveItem = async (item: CartItem) => {
    setUpdatingId(item.id);
    try {
      const res = await deleteRow(item);
      if (!res || res.ok) {
        setCartItems(prev => prev.filter(ci => ci.id !== item.id));
      }
    } catch (error) {
      console.error('삭제 실패:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleClearCart = async () => {
    if (!confirm(t.cart.clearCart + '?')) return;
    try {
      if (user) {
        await authFetch('/api/cart', { method: 'DELETE' });
      } else {
        clearGuestCart();
      }
      setCartItems([]);
    } catch (error) {
      console.error('장바구니 비우기 실패:', error);
    }
  };

  // 선택된 상품만 합계 계산 (쿠팡식 선택결제)
  const selectedItems = cartItems.filter((item) => selectedIds.has(item.id));
  const selectedCount = selectedItems.length;
  const totalAmount = selectedItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  // [정책] 전 상품 무조건 무료배송 — 가격과 무관하게 배송비 항상 0원
  const shippingFee = 0;
  const finalAmount = totalAmount + shippingFee;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ShopNavigation />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">{t.cart.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-0">
      <ShopNavigation />

      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {t.cart.title} ({cartItems.length})
          </h1>
          {cartItems.length > 0 && (
            <button
              onClick={handleClearCart}
              className="text-sm text-red-500 hover:text-red-700 font-medium"
            >
              {t.cart.clearCart}
            </button>
          )}
        </div>

        {cartItems.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm text-center py-20">
            <span className="text-6xl block mb-4">🛒</span>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t.cart.empty}</h2>
            <p className="text-gray-500 mb-6">{t.cart.goShopping}</p>
            <Link
              href="/products"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition"
            >
              {t.cart.goShopping}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 상품 목록 */}
            <div className="lg:col-span-2 space-y-3">
              {/* 전체선택 / 선택삭제 바 (쿠팡식) */}
              <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-900">
                    전체선택 ({selectedCount}/{cartItems.length})
                  </span>
                </label>
                <button
                  onClick={handleRemoveSelected}
                  disabled={selectedCount === 0}
                  className="text-sm text-gray-500 hover:text-red-600 font-medium disabled:opacity-40 disabled:hover:text-gray-500"
                >
                  선택삭제
                </button>
              </div>

              {cartItems.map(item => (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl shadow-sm p-4 flex gap-3 sm:gap-4 transition ${
                    updatingId === item.id ? 'opacity-50' : ''
                  }`}
                >
                  {/* 선택 체크박스 (쿠팡식) */}
                  <div className="flex items-start pt-1">
                    <input
                      type="checkbox"
                      checked={isSelected(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      aria-label="상품 선택"
                    />
                  </div>

                  {/* 썸네일 */}
                  <Link
                    href={`/products/${item.product.slug}`}
                    className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100"
                  >
                    <img
                      src={thumbUrl(item.product.thumbnail, 200)}
                      alt={item.product.name}
                      loading="lazy"
                      width={112}
                      height={112}
                      className="w-full h-full object-cover"
                      onError={e => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML =
                          '<div class="w-full h-full flex items-center justify-center text-3xl bg-gray-100">📦</div>';
                      }}
                    />
                  </Link>

                  {/* 상품 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {item.product.category && (
                          <p className="text-xs text-gray-400 mb-0.5">{tr(item.product.category.name)}</p>
                        )}
                        <Link
                          href={`/products/${item.product.slug}`}
                          className="text-sm sm:text-base font-semibold text-gray-900 hover:text-blue-600 line-clamp-2 transition"
                        >
                          {tr(item.product.name)}
                        </Link>
                        {item.optionLabel && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">옵션: {item.optionLabel}</p>
                        )}
                        {item.optionLabel && getBundleSize(item.product.name) > 1 && (
                          <p className="text-xs text-blue-600 mt-0.5">
                            🎁 {getBundleSize(item.product.name)}개 묶음 — 옵션 합계 {getBundleSize(item.product.name)}개 단위로 구매
                          </p>
                        )}
                      </div>
                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => handleRemoveItem(item)}
                        disabled={updatingId === item.id}
                        className="flex-shrink-0 text-gray-400 hover:text-red-500 transition p-1"
                        title={t.cart.remove}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* 가격 */}
                    <div className="mt-2">
                      {item.product.comparePrice && item.product.comparePrice > item.product.price && (
                        <span className="text-xs text-gray-400 line-through mr-2">
                          ₩{item.product.comparePrice.toLocaleString()}
                        </span>
                      )}
                      <span className="text-base font-bold text-gray-900">
                        ₩{item.product.price.toLocaleString()}
                      </span>
                    </div>

                    {/* 수량 조절 */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                        <button
                          onClick={() => handleQuantityChange(item, item.quantity - 1)}
                          disabled={item.quantity <= 1 || updatingId === item.id}
                          className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 transition disabled:opacity-30"
                        >
                          -
                        </button>
                        <span className="w-10 text-center text-sm font-medium text-gray-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(item, item.quantity + 1)}
                          disabled={item.quantity >= item.product.stock || updatingId === item.id}
                          className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 transition disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-bold text-gray-900">
                        ₩{(item.product.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 결제 요약 */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm p-5 sticky top-20 space-y-4">
                <h2 className="text-lg font-bold text-gray-900">{t.cart.orderSummary}</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>{t.cart.productTotal}</span>
                    <span>₩{totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>{t.cart.shippingFee}</span>
                    <span>
                      <span className="text-green-600 font-medium">{t.common.free}</span>
                    </span>
                  </div>
                  {/* [정책] 전 상품 무조건 무료배송이므로 '더 담으면 무료배송' 안내 불필요 */}
                  <div className="border-t pt-3 flex justify-between text-lg font-bold text-gray-900">
                    <span>{t.cart.finalAmount}</span>
                    <span className="text-blue-600">₩{finalAmount.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckoutSelected}
                  disabled={selectedCount === 0}
                  className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {selectedCount === 0
                    ? '구매할 상품을 선택하세요'
                    : `총 ${selectedCount}개 상품 구매하기`}
                </button>

                <Link
                  href="/products"
                  className="block text-center text-sm text-gray-500 hover:text-gray-700 font-medium mt-2"
                >
                  {t.cart.continueShopping}
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
