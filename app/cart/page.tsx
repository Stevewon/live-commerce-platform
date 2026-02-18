'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CartItem {
  id: string;
  name: string;
  price: number;
  thumbnail: string;
  quantity: number;
}

export default function CartPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = () => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    setCartItems(cart);
    setIsLoading(false);
  };

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    const updatedCart = cartItems.map((item) =>
      item.id === id ? { ...item, quantity: newQuantity } : item
    );
    setCartItems(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
  };

  const removeItem = (id: string) => {
    const updatedCart = cartItems.filter((item) => item.id !== id);
    setCartItems(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
  };

  const clearCart = () => {
    if (confirm('장바구니를 비우시겠습니까?')) {
      setCartItems([]);
      localStorage.setItem('cart', JSON.stringify([]));
    }
  };

  const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 헤더 */}
      <header className="bg-gray-800/50 backdrop-blur-md border-b border-gray-700">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              Live Commerce
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/cart" className="relative">
                <span className="text-2xl">🛒</span>
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

      {/* 메인 컨텐츠 */}
      <div className="container mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-8">장바구니</h1>

        {cartItems.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-8xl mb-6">🛒</div>
            <p className="text-2xl text-gray-400 mb-8">장바구니가 비어있습니다</p>
            <Link
              href="/"
              className="inline-block bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105"
            >
              쇼핑 계속하기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 왼쪽: 장바구니 아이템 */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-gray-400">총 {cartItems.length}개 상품</p>
                <button
                  onClick={clearCart}
                  className="text-red-400 hover:text-red-300 transition-colors text-sm"
                >
                  전체 삭제
                </button>
              </div>

              {cartItems.map((item) => (
                <div key={item.id} className="bg-gray-800/30 rounded-xl p-6 flex gap-6">
                  {/* 상품 이미지 */}
                  <div className="relative w-24 h-24 bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover" />
                  </div>

                  {/* 상품 정보 */}
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-2">{item.name}</h3>
                    <p className="text-blue-400 font-bold text-xl mb-4">
                      ₩{(item.price * item.quantity).toLocaleString()}
                    </p>

                    <div className="flex items-center gap-4">
                      {/* 수량 조절 */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors"
                        >
                          -
                        </button>
                        <span className="font-bold w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors"
                        >
                          +
                        </button>
                      </div>

                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="ml-auto text-red-400 hover:text-red-300 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 오른쪽: 주문 요약 */}
            <div className="lg:col-span-1">
              <div className="bg-gray-800/30 rounded-xl p-6 sticky top-24">
                <h2 className="text-2xl font-bold mb-6">주문 요약</h2>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between">
                    <span className="text-gray-400">상품 금액</span>
                    <span className="font-bold">₩{totalPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
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
                  <div className="border-t border-gray-700 pt-4">
                    <div className="flex justify-between text-xl font-bold">
                      <span>총 결제 금액</span>
                      <span className="text-blue-400">₩{finalPrice.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => alert('결제 기능은 준비중입니다!')}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 mb-4"
                >
                  결제하기
                </button>

                <Link
                  href="/"
                  className="block w-full bg-gray-700 hover:bg-gray-600 text-white py-4 rounded-xl font-bold text-center transition-colors"
                >
                  쇼핑 계속하기
                </Link>

                {/* 배송 정보 */}
                <div className="mt-6 space-y-3 text-sm text-gray-400">
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
