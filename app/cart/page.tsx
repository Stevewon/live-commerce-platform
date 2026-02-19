'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    thumbnail: string;
    slug: string;
  };
}

export default function CartPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && token) {
      loadCart();
    } else {
      setIsLoading(false);
    }
  }, [user, token]);

  const loadCart = async () => {
    if (!token) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/cart', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '장바구니를 불러올 수 없습니다');
      }

      setCartItems(data.data || []);
    } catch (err: any) {
      console.error('Load cart error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = async (productId: string, newQuantity: number) => {
    if (newQuantity < 1 || !token) return;

    try {
      const response = await fetch('/api/cart', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ productId, quantity: newQuantity })
      });

      if (!response.ok) {
        throw new Error('수량 변경에 실패했습니다');
      }

      // 로컬 상태 업데이트
      setCartItems(cartItems.map(item =>
        item.productId === productId ? { ...item, quantity: newQuantity } : item
      ));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const removeItem = async (productId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/cart?productId=${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('상품 삭제에 실패했습니다');
      }

      setCartItems(cartItems.filter(item => item.productId !== productId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const clearCart = async () => {
    if (!token) return;
    if (!confirm('장바구니를 비우시겠습니까?')) return;

    try {
      const response = await fetch('/api/cart', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('장바구니 비우기에 실패했습니다');
      }

      setCartItems([]);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const totalPrice = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shippingFee = totalPrice >= 50000 ? 0 : 3000;
  const finalPrice = totalPrice + shippingFee;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">장바구니를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 로그인하지 않은 경우
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-8xl mb-6">🔒</div>
          <h2 className="text-3xl font-bold mb-4">로그인이 필요합니다</h2>
          <p className="text-gray-400 mb-8">장바구니를 사용하려면 로그인해주세요</p>
          <Link
            href="/partner/login"
            className="inline-block px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg"
          >
            로그인하기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 헤더 - 모바일 최적화 */}
      <header className="bg-gray-800/50 backdrop-blur-md border-b border-gray-700">
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
              <Link href="/cart" className="relative">
                <span className="text-xl sm:text-2xl">🛒</span>
                {cartItems.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {cartItems.length}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 - 모바일 최적화 */}
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8">장바구니</h1>

        {cartItems.length === 0 ? (
          <div className="text-center py-16 sm:py-24">
            <div className="text-6xl sm:text-8xl mb-4 sm:mb-6">🛒</div>
            <p className="text-xl sm:text-2xl text-gray-400 mb-6 sm:mb-8">장바구니가 비어있습니다</p>
            <Link
              href="/"
              className="inline-block bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all hover:scale-105"
            >
              쇼핑 계속하기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* 왼쪽: 장바구니 아이템 - 모바일 최적화 */}
            <div className="lg:col-span-2 space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <p className="text-sm sm:text-base text-gray-400">총 {cartItems.length}개 상품</p>
                <button
                  onClick={clearCart}
                  className="text-red-400 hover:text-red-300 transition-colors text-xs sm:text-sm"
                >
                  전체 삭제
                </button>
              </div>

              {cartItems.map((item) => (
                <div key={item.id} className="bg-gray-800/30 rounded-xl p-4 sm:p-6 flex gap-4 sm:gap-6">
                  {/* 상품 이미지 */}
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={item.product.thumbnail} alt={item.product.name} className="w-full h-full object-cover" />
                  </div>

                  {/* 상품 정보 - 모바일 최적화 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm sm:text-base lg:text-lg mb-2 line-clamp-2">{item.product.name}</h3>
                    <p className="text-blue-400 font-bold text-base sm:text-lg lg:text-xl mb-3 sm:mb-4">
                      ₩{(item.product.price * item.quantity).toLocaleString()}
                    </p>

                    <div className="flex items-center gap-3 sm:gap-4">
                      {/* 수량 조절 - 모바일 최적화 */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors text-sm"
                        >
                          -
                        </button>
                        <span className="font-bold w-6 sm:w-8 text-center text-sm sm:text-base">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors text-sm"
                        >
                          +
                        </button>
                      </div>

                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="ml-auto text-red-400 hover:text-red-300 transition-colors text-xs sm:text-sm"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 오른쪽: 주문 요약 - 모바일 최적화 */}
            <div className="lg:col-span-1">
              <div className="bg-gray-800/30 rounded-xl p-5 sm:p-6 sticky top-20 sm:top-24">
                <h2 className="text-xl sm:text-2xl font-bold mb-5 sm:mb-6">주문 요약</h2>

                <div className="space-y-3 sm:space-y-4 mb-5 sm:mb-6">
                  <div className="flex justify-between text-sm sm:text-base">
                    <span className="text-gray-400">상품 금액</span>
                    <span className="font-bold">₩{totalPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm sm:text-base">
                    <span className="text-gray-400">배송비</span>
                    <span className="font-bold">
                      {shippingFee === 0 ? (
                        <span className="text-green-400">무료</span>
                      ) : (
                        `₩${shippingFee.toLocaleString()}`
                      )}
                    </span>
                  </div>
                  {totalPrice < 50000 && (
                    <div className="text-sm text-orange-400 bg-orange-400/10 p-3 rounded-lg">
                      ₩{(50000 - totalPrice).toLocaleString()} 더 담으면 무료배송!
                    </div>
                  )}
                  <div className="border-t border-gray-700 pt-3 sm:pt-4">
                    <div className="flex justify-between text-lg sm:text-xl font-bold">
                      <span>총 결제 금액</span>
                      <span className="text-blue-400">₩{finalPrice.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => router.push('/checkout')}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all hover:scale-105 mb-3 sm:mb-4"
                >
                  주문하기
                </button>

                <Link
                  href="/"
                  className="block w-full bg-gray-700 hover:bg-gray-600 text-white py-3 sm:py-4 rounded-xl font-bold text-center transition-colors text-base"
                >
                  쇼핑 계속하기
                </Link>

                {/* 배송 정보 - 모바일 최적화 */}
                <div className="mt-5 sm:mt-6 space-y-2 sm:space-y-3 text-xs sm:text-sm text-gray-400">
                  <div className="flex items-start gap-2">
                    <span>🚚</span>
                    <p>평균 2-3일 배송</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>↩️</span>
                    <p>30일 이내 무료 반품</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>🛡️</span>
                    <p>안전한 결제 보장</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 푸터 */}
      <footer className="bg-gray-800/50 border-t border-gray-700 py-8 mt-16">
        <div className="container mx-auto px-6 text-center text-gray-400">
          <p>© 2026 Live Commerce Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
