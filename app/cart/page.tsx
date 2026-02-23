'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import ShopNavigation from '@/components/ShopNavigation';

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    stock: number;
    thumbnail: string;
    category: {
      name: string;
      slug: string;
    };
  };
}

export default function CartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchCart();
  }, [user]);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cart', {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setCartItems(data.data || []);
      }
    } catch (error) {
      console.error('장바구니 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (productId: string, newQuantity: number) => {
    try {
      setUpdating(productId);
      const res = await fetch('/api/cart', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, quantity: newQuantity }),
      });

      if (res.ok) {
        await fetchCart();
      } else {
        alert('수량 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('수량 변경 실패:', error);
      alert('수량 변경에 실패했습니다.');
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (productId: string) => {
    if (!confirm('이 상품을 장바구니에서 삭제하시겠습니까?')) {
      return;
    }

    try {
      setUpdating(productId);
      const res = await fetch(`/api/cart?productId=${productId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        await fetchCart();
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    } finally {
      setUpdating(null);
    }
  };

  const clearCart = async () => {
    if (!confirm('장바구니를 전체 비우시겠습니까?')) {
      return;
    }

    try {
      const res = await fetch('/api/cart', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setCartItems([]);
      } else {
        alert('장바구니 비우기에 실패했습니다.');
      }
    } catch (error) {
      console.error('장바구니 비우기 실패:', error);
    }
  };

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const shippingFee = totalAmount > 0 ? 3000 : 0;
  const finalAmount = totalAmount + shippingFee;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ShopNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">🛒 장바구니</h1>
          <p className="mt-2 text-gray-600">장바구니에 담긴 상품을 확인하세요</p>
        </div>

        {cartItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">🛒</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">장바구니가 비어있습니다</h2>
            <p className="text-gray-600 mb-6">상품을 담아보세요!</p>
            <Link
              href="/products"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              쇼핑 계속하기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 장바구니 아이템 목록 */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center">
                  <h2 className="font-semibold text-lg">상품 목록 ({cartItems.length}개)</h2>
                  <button
                    onClick={clearCart}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    전체 삭제
                  </button>
                </div>

                <div className="divide-y">
                  {cartItems.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-gray-50">
                      <div className="flex gap-4">
                        {/* 상품 이미지 */}
                        <Link
                          href={`/products/${item.product.slug}`}
                          className="flex-shrink-0"
                        >
                          <img
                            src={item.product.thumbnail}
                            alt={item.product.name}
                            className="w-24 h-24 object-cover rounded-lg"
                          />
                        </Link>

                        {/* 상품 정보 */}
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/products/${item.product.slug}`}
                            className="block"
                          >
                            <p className="text-xs text-gray-500 mb-1">
                              {item.product.category.name}
                            </p>
                            <h3 className="font-semibold text-gray-900 hover:text-blue-600 mb-2">
                              {item.product.name}
                            </h3>
                          </Link>

                          <p className="text-lg font-bold text-gray-900 mb-3">
                            ₩{item.product.price.toLocaleString()}
                          </p>

                          {/* 수량 조절 */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                updateQuantity(item.productId, item.quantity - 1)
                              }
                              disabled={updating === item.productId || item.quantity <= 1}
                              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                            >
                              −
                            </button>
                            <span className="w-12 text-center font-medium">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(item.productId, item.quantity + 1)
                              }
                              disabled={
                                updating === item.productId ||
                                item.quantity >= item.product.stock
                              }
                              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                            >
                              +
                            </button>
                            <button
                              onClick={() => removeItem(item.productId)}
                              disabled={updating === item.productId}
                              className="ml-4 text-sm text-red-600 hover:text-red-700"
                            >
                              삭제
                            </button>
                          </div>

                          {item.quantity >= item.product.stock && (
                            <p className="text-xs text-red-600 mt-1">
                              재고: {item.product.stock}개
                            </p>
                          )}
                        </div>

                        {/* 소계 */}
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">
                            ₩{(item.product.price * item.quantity).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 주문 요약 */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6 sticky top-4">
                <h2 className="text-lg font-bold text-gray-900 mb-4">주문 요약</h2>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-gray-600">
                    <span>상품 금액</span>
                    <span>₩{totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>배송비</span>
                    <span>₩{shippingFee.toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between text-lg font-bold text-gray-900">
                    <span>총 결제 금액</span>
                    <span className="text-blue-600">₩{finalAmount.toLocaleString()}</span>
                  </div>
                </div>

                <Link
                  href="/checkout"
                  className="block w-full py-3 bg-blue-600 text-white text-center rounded-lg font-semibold hover:bg-blue-700 transition mb-2"
                >
                  주문하기
                </Link>

                <Link
                  href="/products"
                  className="block w-full py-3 bg-gray-100 text-gray-700 text-center rounded-lg font-medium hover:bg-gray-200 transition"
                >
                  쇼핑 계속하기
                </Link>

                <div className="mt-4 pt-4 border-t text-xs text-gray-500 space-y-1">
                  <p>• 50,000원 이상 구매 시 무료배송</p>
                  <p>• 주문 후 2-3일 이내 배송</p>
                  <p>• 교환/반품 가능 (7일 이내)</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
