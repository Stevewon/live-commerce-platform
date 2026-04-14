'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import ShopNavigation from '@/components/ShopNavigation';
import {
  getGuestCart,
  updateGuestCartQuantity,
  removeFromGuestCart,
  clearGuestCart,
  GuestCartItem,
} from '@/lib/utils/guestCart';

interface CartItem {
  id: string;
  productId: string;
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
        const res = await fetch('/api/cart', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const serverItems = (data.data || []).map((item: any) => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            product: {
              id: item.product?.id || item.productId,
              name: item.product?.name || '상품',
              slug: item.product?.slug || '',
              price: item.product?.price || 0,
              comparePrice: item.product?.comparePrice || null,
              stock: item.product?.stock ?? 0,
              thumbnail: item.product?.thumbnail || '',
              category: item.product?.category || null,
            },
          }));
          setCartItems(serverItems);
        }
      } else {
        // 비회원: localStorage 장바구니
        const guestItems = getGuestCart();
        const mapped: CartItem[] = guestItems.map((item, idx) => ({
          id: `guest-${idx}-${item.productId}`,
          productId: item.productId,
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
        const res = await fetch('/api/cart', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: item.productId, quantity: newQuantity }),
        });
        if (res.ok) {
          setCartItems(prev =>
            prev.map(ci => (ci.id === item.id ? { ...ci, quantity: newQuantity } : ci))
          );
        }
      } else {
        updateGuestCartQuantity(item.productId, newQuantity);
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
      if (user) {
        const res = await fetch(`/api/cart?productId=${item.productId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (res.ok) {
          setCartItems(prev => prev.filter(ci => ci.id !== item.id));
        }
      } else {
        removeFromGuestCart(item.productId);
        setCartItems(prev => prev.filter(ci => ci.id !== item.id));
      }
    } catch (error) {
      console.error('삭제 실패:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleClearCart = async () => {
    if (!confirm('장바구니를 비우시겠습니까?')) return;
    try {
      if (user) {
        await fetch('/api/cart', { method: 'DELETE', credentials: 'include' });
      } else {
        clearGuestCart();
      }
      setCartItems([]);
    } catch (error) {
      console.error('장바구니 비우기 실패:', error);
    }
  };

  const totalAmount = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shippingFee = totalAmount > 0
    ? (shippingConfig.freeShippingThreshold > 0 && totalAmount >= shippingConfig.freeShippingThreshold ? 0 : shippingConfig.shippingFee)
    : 0;
  const finalAmount = totalAmount + shippingFee;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ShopNavigation />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">장바구니를 불러오는 중...</p>
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
            장바구니 ({cartItems.length})
          </h1>
          {cartItems.length > 0 && (
            <button
              onClick={handleClearCart}
              className="text-sm text-red-500 hover:text-red-700 font-medium"
            >
              전체 삭제
            </button>
          )}
        </div>

        {cartItems.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm text-center py-20">
            <span className="text-6xl block mb-4">🛒</span>
            <h2 className="text-xl font-bold text-gray-900 mb-2">장바구니가 비어있습니다</h2>
            <p className="text-gray-500 mb-6">상품을 담아보세요!</p>
            <Link
              href="/products"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition"
            >
              쇼핑하러 가기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 상품 목록 */}
            <div className="lg:col-span-2 space-y-3">
              {cartItems.map(item => (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl shadow-sm p-4 flex gap-4 transition ${
                    updatingId === item.id ? 'opacity-50' : ''
                  }`}
                >
                  {/* 썸네일 */}
                  <Link
                    href={`/products/${item.product.slug}`}
                    className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100"
                  >
                    <img
                      src={item.product.thumbnail}
                      alt={item.product.name}
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
                          <p className="text-xs text-gray-400 mb-0.5">{item.product.category.name}</p>
                        )}
                        <Link
                          href={`/products/${item.product.slug}`}
                          className="text-sm sm:text-base font-semibold text-gray-900 hover:text-blue-600 line-clamp-2 transition"
                        >
                          {item.product.name}
                        </Link>
                      </div>
                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => handleRemoveItem(item)}
                        disabled={updatingId === item.id}
                        className="flex-shrink-0 text-gray-400 hover:text-red-500 transition p-1"
                        title="삭제"
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
                <h2 className="text-lg font-bold text-gray-900">주문 요약</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>상품 금액</span>
                    <span>₩{totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>배송비</span>
                    <span>
                      {shippingFee === 0 ? (
                        <span className="text-green-600 font-medium">무료</span>
                      ) : (
                        `₩${shippingFee.toLocaleString()}`
                      )}
                    </span>
                  </div>
                  {totalAmount > 0 && shippingConfig.freeShippingThreshold > 0 && totalAmount < shippingConfig.freeShippingThreshold && (
                    <p className="text-xs text-blue-600">
                      ₩{(shippingConfig.freeShippingThreshold - totalAmount).toLocaleString()} 더 담으면 무료배송!
                    </p>
                  )}
                  <div className="border-t pt-3 flex justify-between text-lg font-bold text-gray-900">
                    <span>총 결제 예상 금액</span>
                    <span className="text-blue-600">₩{finalAmount.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => router.push('/checkout')}
                  className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition"
                >
                  주문하기 ({cartItems.length}개)
                </button>

                <Link
                  href="/products"
                  className="block text-center text-sm text-gray-500 hover:text-gray-700 font-medium mt-2"
                >
                  쇼핑 계속하기
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
