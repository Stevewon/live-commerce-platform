'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import ShopNavigation from '@/components/ShopNavigation';

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    thumbnail: string;
  };
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 배송 정보
  const [shippingName, setShippingName] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingZipCode, setShippingZipCode] = useState('');
  const [shippingMemo, setShippingMemo] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchCart();
  }, [user]);

  const fetchCart = async () => {
    try {
      const res = await fetch('/api/cart', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCartItems(data.data || []);
        
        // 사용자 정보로 자동 채우기
        if (user) {
          setShippingName(user.name || '');
          setShippingPhone(user.phone || '');
        }
      }
    } catch (error) {
      console.error('장바구니 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const shippingFee = totalAmount >= 50000 ? 0 : 3000;
  const finalAmount = totalAmount + shippingFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!shippingName || !shippingPhone || !shippingAddress) {
      alert('배송 정보를 모두 입력해주세요.');
      return;
    }

    if (cartItems.length === 0) {
      alert('장바구니가 비어있습니다.');
      return;
    }

    try {
      setSubmitting(true);

      // 주문 생성
      const orderData = {
        items: cartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.product.price,
        })),
        shippingName,
        shippingPhone,
        shippingAddress,
        shippingZipCode,
        shippingMemo,
        paymentMethod: 'card',
        shippingFee,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(orderData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '주문 생성 실패');
      }

      const { data: order } = await res.json();

      // Toss Payments 결제
      const tossPayments = await loadTossPayments(
        process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq'
      );

      await tossPayments.requestPayment('카드', {
        amount: finalAmount,
        orderId: order.orderNumber,
        orderName: `${cartItems[0].product.name} 외 ${cartItems.length - 1}건`,
        customerName: shippingName,
        successUrl: `${window.location.origin}/orders/success?orderId=${order.id}`,
        failUrl: `${window.location.origin}/orders/fail`,
      });
    } catch (error: any) {
      console.error('주문 실패:', error);
      alert(error.message || '주문 처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">장바구니가 비어있습니다</h1>
          <button
            onClick={() => router.push('/products')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg"
          >
            쇼핑하러 가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ShopNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">주문/결제</h1>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 주문 정보 */}
            <div className="lg:col-span-2 space-y-6">
              {/* 배송 정보 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">배송 정보</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      받는 사람 *
                    </label>
                    <input
                      type="text"
                      value={shippingName}
                      onChange={(e) => setShippingName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      연락처 *
                    </label>
                    <input
                      type="tel"
                      value={shippingPhone}
                      onChange={(e) => setShippingPhone(e.target.value)}
                      placeholder="010-0000-0000"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      우편번호
                    </label>
                    <input
                      type="text"
                      value={shippingZipCode}
                      onChange={(e) => setShippingZipCode(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      주소 *
                    </label>
                    <input
                      type="text"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      배송 메모
                    </label>
                    <textarea
                      value={shippingMemo}
                      onChange={(e) => setShippingMemo(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="배송 시 요청사항을 입력하세요"
                    />
                  </div>
                </div>
              </div>

              {/* 주문 상품 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  주문 상품 ({cartItems.length}개)
                </h2>
                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <img
                        src={item.product.thumbnail}
                        alt={item.product.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {item.product.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          ₩{item.product.price.toLocaleString()} × {item.quantity}개
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">
                          ₩{(item.product.price * item.quantity).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 결제 정보 */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6 sticky top-4">
                <h2 className="text-xl font-bold text-gray-900 mb-4">결제 정보</h2>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-gray-600">
                    <span>상품 금액</span>
                    <span>₩{totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>배송비</span>
                    <span>₩{shippingFee.toLocaleString()}</span>
                  </div>
                  {totalAmount >= 50000 && (
                    <p className="text-xs text-green-600">무료배송 적용!</p>
                  )}
                  <div className="border-t pt-3 flex justify-between text-xl font-bold text-gray-900">
                    <span>총 결제 금액</span>
                    <span className="text-blue-600">₩{finalAmount.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition"
                >
                  {submitting ? '처리 중...' : `₩${finalAmount.toLocaleString()} 결제하기`}
                </button>

                <div className="mt-4 pt-4 border-t text-xs text-gray-500 space-y-1">
                  <p>• 결제는 Toss Payments로 안전하게 처리됩니다</p>
                  <p>• 주문 후 2-3일 이내 배송</p>
                  <p>• 교환/반품 가능 (7일 이내)</p>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
