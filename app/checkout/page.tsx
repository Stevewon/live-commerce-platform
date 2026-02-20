'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import Link from 'next/link';
import { loadTossPayments } from '@tosspayments/payment-sdk';

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
  const { user, token } = useAuth();
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 쿠폰 관련 상태
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [isCouponLoading, setIsCouponLoading] = useState(false);
  
  // 배송 정보
  const [shippingInfo, setShippingInfo] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    zipCode: '',
    address: '',
    memo: ''
  });

  useEffect(() => {
    if (!user || !token) {
      alert('로그인이 필요합니다');
      router.push('/partner/login');
      return;
    }
    loadCart();
  }, [user, token]);

  const loadCart = async () => {
    if (!token) return;

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

      setCartItems(data.cart || []);
    } catch (error: any) {
      console.error('Load cart error:', error);
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shippingFee = appliedCoupon?.discount?.shippingDiscount ? 0 : (subtotal >= 50000 ? 0 : 3000);
  const discount = couponDiscount;
  const total = subtotal - discount + shippingFee;

  // 쿠폰 적용
  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      alert('쿠폰 코드를 입력해주세요');
      return;
    }

    setIsCouponLoading(true);

    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: couponCode,
          subtotal
        })
      });

      const result = await response.json();

      if (result.success) {
        setAppliedCoupon(result.data);
        setCouponDiscount(result.data.discount.amount || 0);
        alert('쿠폰이 적용되었습니다!');
      } else {
        alert(result.error || '쿠폰 적용에 실패했습니다');
      }
    } catch (error) {
      console.error('쿠폰 적용 실패:', error);
      alert('쿠폰 적용 중 오류가 발생했습니다');
    } finally {
      setIsCouponLoading(false);
    }
  };

  // 쿠폰 제거
  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponCode('');
  };

  const handlePayment = async () => {
    if (!token || !user) {
      alert('로그인이 필요합니다');
      router.push('/partner/login');
      return;
    }

    // 유효성 검사
    if (!shippingInfo.name || !shippingInfo.phone || !shippingInfo.address) {
      alert('배송 정보를 모두 입력해주세요');
      return;
    }

    if (cartItems.length === 0) {
      alert('장바구니가 비어있습니다');
      return;
    }

    setIsProcessing(true);

    try {
      // 1. 주문 생성
      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: cartItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price
          })),
          shippingName: shippingInfo.name,
          shippingPhone: shippingInfo.phone,
          shippingAddress: shippingInfo.address,
          shippingZipCode: shippingInfo.zipCode || null,
          shippingMemo: shippingInfo.memo || null,
          paymentMethod: 'CARD',
          shippingFee,
          couponCode: appliedCoupon?.coupon?.code || null // 쿠폰 코드 전달
        })
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(orderData.error || '주문 생성에 실패했습니다');
      }

      // 2. Toss Payments 결제 요청
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || '';
      const tossPayments = await loadTossPayments(clientKey);

      await tossPayments.requestPayment('카드', {
        amount: total,
        orderId: orderData.order.orderNumber,
        orderName: cartItems.length > 1 
          ? `${cartItems[0].product.name} 외 ${cartItems.length - 1}건`
          : cartItems[0].product.name,
        customerName: shippingInfo.name,
        successUrl: `${window.location.origin}/payment/success?orderId=${orderData.order.id}`,
        failUrl: `${window.location.origin}/payment/fail`,
      });

    } catch (error: any) {
      console.error('Payment error:', error);
      alert(error.message || '결제 처리 중 오류가 발생했습니다');
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl mb-6">🛒</div>
          <h2 className="text-3xl font-bold mb-4">장바구니가 비어있습니다</h2>
          <Link
            href="/shop"
            className="inline-block px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg"
          >
            쇼핑하러 가기 →
          </Link>
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
            <Link href="/cart" className="text-blue-400 hover:text-blue-300">
              ← 장바구니로
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold mb-8">주문/결제</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* 좌측: 주문 상품 & 배송 정보 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 주문 상품 */}
            <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6">
              <h2 className="text-2xl font-bold mb-4">주문 상품 ({cartItems.length})</h2>
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-700/30 rounded-xl">
                    <img
                      src={item.product.thumbnail}
                      alt={item.product.name}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">{item.product.name}</h3>
                      <p className="text-gray-400 text-sm">수량: {item.quantity}개</p>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-400 font-bold text-lg">
                        ₩{(item.product.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 배송 정보 */}
            <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6">
              <h2 className="text-2xl font-bold mb-4">배송 정보</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">받는 사람 *</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    value={shippingInfo.name}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, name: e.target.value })}
                    placeholder="홍길동"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">연락처 *</label>
                  <input
                    type="tel"
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    value={shippingInfo.phone}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, phone: e.target.value })}
                    placeholder="010-1234-5678"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">우편번호</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    value={shippingInfo.zipCode}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, zipCode: e.target.value })}
                    placeholder="12345"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">배송 주소 *</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    value={shippingInfo.address}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, address: e.target.value })}
                    placeholder="서울시 강남구 테헤란로 123"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">배송 메모</label>
                  <textarea
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500 resize-none"
                    value={shippingInfo.memo}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, memo: e.target.value })}
                    placeholder="문 앞에 놔주세요"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 우측: 결제 정보 */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6 sticky top-6">
              <h2 className="text-2xl font-bold mb-6">결제 정보</h2>
              
              {/* 쿠폰 입력 */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">쿠폰 코드</label>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-3 bg-purple-500/20 border border-purple-500/50 rounded-lg">
                    <div>
                      <div className="text-purple-400 font-medium">{appliedCoupon.coupon.name}</div>
                      <div className="text-xs text-gray-400">{appliedCoupon.coupon.code}</div>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      제거
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="쿠폰 코드 입력"
                      className="flex-1 px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={isCouponLoading || !couponCode}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCouponLoading ? '확인 중...' : '적용'}
                    </button>
                  </div>
                )}
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-gray-300">
                  <span>상품금액</span>
                  <span>₩{subtotal.toLocaleString()}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-purple-400">
                    <span>할인금액</span>
                    <span>-₩{discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-300">
                  <span>배송비</span>
                  <span>{shippingFee === 0 ? '무료' : `₩${shippingFee.toLocaleString()}`}</span>
                </div>
                {subtotal < 50000 && (
                  <p className="text-sm text-yellow-400">
                    ₩{(50000 - subtotal).toLocaleString()} 더 구매하시면 무료배송!
                  </p>
                )}
                <div className="border-t border-gray-700 pt-4 flex justify-between text-xl font-bold">
                  <span>총 결제금액</span>
                  <span className="text-blue-400">₩{total.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handlePayment}
                disabled={isProcessing}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg disabled:transform-none disabled:cursor-not-allowed"
              >
                {isProcessing ? '처리 중...' : '결제하기'}
              </button>

              <div className="mt-4 space-y-2 text-xs text-gray-400">
                <p>• 결제 수단: 신용카드 (Toss Payments)</p>
                <p>• 테스트 환경에서는 실제 결제가 이루어지지 않습니다</p>
                <p>• 주문 취소는 마이페이지에서 가능합니다</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
