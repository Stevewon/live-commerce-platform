'use client';
import { useAuth } from '@/lib/contexts/AuthContext'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import ShopNavigation from '@/components/ShopNavigation';
import { getGuestCart, clearGuestCart, removeFromGuestCart, GuestCartItem } from '@/lib/utils/guestCart';
import AddressSearch from '@/components/AddressSearch';
import CouponInput from '@/components/CouponInput';

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

interface CouponData {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  value: number;
  minAmount: number | null;
  maxDiscount: number | null;
  discountAmount: number;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  // 배송 정보
  const [shippingName, setShippingName] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingAddressDetail, setShippingAddressDetail] = useState('');
  const [shippingZipCode, setShippingZipCode] = useState('');
  const [shippingMemo, setShippingMemo] = useState('');

  // 비회원 추가 정보
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  // 쿠폰
  const [appliedCoupon, setAppliedCoupon] = useState<CouponData | null>(null);

  // 파트너 스토어 경유 정보
  const [storePartnerId, setStorePartnerId] = useState<string | null>(null);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);

  // 배송 메모 프리셋
  const MEMO_PRESETS = [
    '직접 입력',
    '문 앞에 놓아주세요',
    '경비실에 맡겨주세요',
    '배송 전 전화 부탁드립니다',
    '부재 시 경비실에 맡겨주세요',
  ];
  const [memoPreset, setMemoPreset] = useState('직접 입력');

  useEffect(() => {
    if (authLoading) return;

    // 바로구매 모드 확인
    const params = new URLSearchParams(window.location.search);
    const isBuyNow = params.get('mode') === 'buynow';

    if (isBuyNow) {
      try {
        const buyNowRaw = sessionStorage.getItem('buyNowItem');
        if (buyNowRaw) {
          const buyNowItem = JSON.parse(buyNowRaw);
          setCartItems([{
            id: 'buynow-0',
            productId: buyNowItem.productId,
            quantity: buyNowItem.quantity,
            product: buyNowItem.product,
          }]);
          sessionStorage.removeItem('buyNowItem');
          setLoading(false);
          if (!user) setIsGuest(true);
          if (user) {
            setShippingName(user.name || '');
            setShippingPhone(user.phone || '');
          }
          // 파트너 스토어 경유 정보 확인
          try {
            const savedPartnerId = sessionStorage.getItem('checkout_partnerId');
            const savedStoreSlug = sessionStorage.getItem('checkout_storeSlug');
            if (savedPartnerId) setStorePartnerId(savedPartnerId);
            if (savedStoreSlug) setStoreSlug(savedStoreSlug);
          } catch {}
          return;
        }
      } catch {}
    }

    if (user) {
      setIsGuest(false);
      fetchCart();
    } else {
      setIsGuest(true);
      loadGuestCart();
    }
    // 파트너 스토어 경유 정보 확인
    try {
      const savedPartnerId = sessionStorage.getItem('checkout_partnerId');
      const savedStoreSlug = sessionStorage.getItem('checkout_storeSlug');
      if (savedPartnerId) setStorePartnerId(savedPartnerId);
      if (savedStoreSlug) setStoreSlug(savedStoreSlug);
    } catch {}
  }, [user, authLoading]);

  const fetchCart = async () => {
    try {
      const res = await fetch('/api/cart', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const serverItems = data.data || [];
        setCartItems(serverItems);
        if (serverItems.length === 0) {
          const guestItems = getGuestCart();
          if (guestItems.length > 0) {
            const mapped: CartItem[] = guestItems.map((item, idx) => ({
              id: `guest-${idx}`,
              productId: item.productId,
              quantity: item.quantity,
              product: {
                id: item.product.id,
                name: item.product.name,
                price: item.product.price,
                thumbnail: item.product.thumbnail,
              },
            }));
            setCartItems(mapped);
          }
        }
        if (user) {
          setShippingName(user.name || '');
          setShippingPhone(user.phone || '');
        }
      } else {
        loadGuestCart();
      }
    } catch (error) {
      console.error('장바구니 조회 실패:', error);
      loadGuestCart();
    } finally {
      setLoading(false);
    }
  };

  const loadGuestCart = () => {
    const guestItems = getGuestCart();
    const mapped: CartItem[] = guestItems.map((item, idx) => ({
      id: `guest-${idx}`,
      productId: item.productId,
      quantity: item.quantity,
      product: {
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        thumbnail: item.product.thumbnail,
      },
    }));
    setCartItems(mapped);
    setLoading(false);
  };

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity, 0
  );
  const shippingFee = totalAmount >= 50000 ? 0 : 3000;
  const couponDiscount = appliedCoupon?.discountAmount || 0;
  const finalAmount = Math.max(0, totalAmount + shippingFee - couponDiscount);

  const handleAddressComplete = (data: { zipCode: string; address: string }) => {
    setShippingZipCode(data.zipCode);
    setShippingAddress(data.address);
  };

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
    if (isGuest) {
      if (!guestEmail && !guestPhone) {
        alert('비회원 주문 시 이메일 또는 연락처를 입력해주세요.');
        return;
      }
      if (!agreeTerms || !agreePrivacy) {
        alert('이용약관 및 개인정보 수집에 동의해주세요.');
        return;
      }
    }

    try {
      setSubmitting(true);
      const fullAddress = shippingAddressDetail
        ? `${shippingAddress} ${shippingAddressDetail}`
        : shippingAddress;

      const finalMemo = memoPreset !== '직접 입력' ? memoPreset : shippingMemo;

      const orderData: any = {
        items: cartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.product.price,
        })),
        shippingName,
        shippingPhone,
        shippingAddress: fullAddress,
        shippingZipCode,
        shippingMemo: finalMemo,
        paymentMethod: 'card',
        shippingFee,
      };

      // 쿠폰 적용
      if (appliedCoupon) {
        orderData.couponId = appliedCoupon.id;
        orderData.couponCode = appliedCoupon.code;
        orderData.discount = couponDiscount;
      }

      // 파트너 스토어 경유 주문 시 partnerId 전달
      if (storePartnerId) {
        orderData.partnerId = storePartnerId;
      }

      if (isGuest) {
        orderData.guestEmail = guestEmail || undefined;
        orderData.guestPhone = guestPhone || shippingPhone;
      }

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

      const result = await res.json();
      const order = result.data;
      const guestOrderToken = result.guestOrderToken;

      if (guestOrderToken) {
        localStorage.setItem('guestOrderToken', guestOrderToken);
        localStorage.setItem('guestOrderNumber', order.orderNumber);
      }

      // 파트너 스토어 경유 정보 정리
      try {
        sessionStorage.removeItem('checkout_partnerId');
        sessionStorage.removeItem('checkout_storeSlug');
      } catch {}

      const tossPayments = await loadTossPayments(
        process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq'
      );

      const orderName = cartItems.length === 1
        ? cartItems[0].product.name
        : `${cartItems[0].product.name} 외 ${cartItems.length - 1}건`;

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

      await tossPayments.requestPayment('카드', {
        amount: finalAmount,
        orderId: order.orderNumber,
        orderName,
        customerName: shippingName,
        successUrl: `${baseUrl}/payment/success?orderId=${order.id}`,
        failUrl: `${baseUrl}/payment/fail?orderId=${order.id}`,
      });
    } catch (error: any) {
      console.error('주문 실패:', error);
      if (error.message !== 'PAY_PROCESS_CANCELED') {
        alert(error.message || '주문 처리 중 오류가 발생했습니다.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">주문 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl block mb-4">🛒</span>
          <h1 className="text-2xl font-bold mb-4">장바구니가 비어있습니다</h1>
          <p className="text-gray-600 mb-6">상품을 담고 주문해주세요</p>
          <a href="/products" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition">
            쇼핑하러 가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      <ShopNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex items-center gap-3 mb-4 sm:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">주문/결제</h1>
          {isGuest && (
            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-bold">
              비회원 주문
            </span>
          )}
        </div>

        {/* 파트너 스토어 경유 안내 */}
        {storePartnerId && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-2xl">🏪</span>
            <div>
              <p className="text-sm font-medium text-blue-700">파트너 스토어를 통한 주문입니다</p>
              {storeSlug && (
                <Link href={`/store/${storeSlug}`} className="text-xs text-blue-500 hover:underline">
                  스토어로 돌아가기
                </Link>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 주문 정보 */}
            <div className="lg:col-span-2 space-y-6">
              {/* 비회원 안내 배너 */}
              {isGuest && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">ℹ️</span>
                    <div>
                      <h3 className="font-bold text-blue-900 mb-1">비회원 주문 안내</h3>
                      <p className="text-sm text-blue-700 mb-3">
                        로그인 없이 주문 가능합니다. 주문 조회를 위해 이메일 또는 연락처를 입력해주세요.
                      </p>
                      <Link href="/login" className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700">
                        회원 로그인하기 →
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* 비회원 주문자 정보 */}
              {isGuest && (
                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                    <span>👤</span> 주문자 정보
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        이메일 <span className="text-gray-400">(주문 확인용)</span>
                      </label>
                      <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)}
                        placeholder="example@email.com"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        연락처 <span className="text-red-500">*</span>
                      </label>
                      <input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)}
                        placeholder="010-0000-0000"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
                      <p className="text-xs text-gray-500 mt-1">비회원 주문 조회 시 필요합니다</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 배송 정보 - 다음 우편번호 API 연동 */}
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <span>🚚</span> 배송 정보
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      받는 사람 <span className="text-red-500">*</span>
                    </label>
                    <input type="text" value={shippingName} onChange={e => setShippingName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      연락처 <span className="text-red-500">*</span>
                    </label>
                    <input type="tel" value={shippingPhone} onChange={e => setShippingPhone(e.target.value)}
                      placeholder="010-0000-0000"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      주소 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input type="text" value={shippingZipCode} readOnly
                        placeholder="우편번호"
                        className="w-32 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700" />
                      <AddressSearch onComplete={handleAddressComplete} />
                    </div>
                    <input type="text" value={shippingAddress} readOnly
                      placeholder="주소 검색 버튼을 클릭하세요"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 mb-2" />
                    <input type="text" value={shippingAddressDetail}
                      onChange={e => setShippingAddressDetail(e.target.value)}
                      placeholder="상세주소 입력 (동/호수 등)"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">배송 메모</label>
                    <select
                      value={memoPreset}
                      onChange={e => {
                        setMemoPreset(e.target.value);
                        if (e.target.value !== '직접 입력') setShippingMemo(e.target.value);
                        else setShippingMemo('');
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-700 mb-2"
                    >
                      {MEMO_PRESETS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    {memoPreset === '직접 입력' && (
                      <textarea value={shippingMemo} onChange={e => setShippingMemo(e.target.value)}
                        rows={2} placeholder="배송 시 요청사항을 입력하세요"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* 주문 상품 */}
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <span>📦</span> 주문 상품 ({cartItems.length}개)
                </h2>
                <div className="space-y-4">
                  {cartItems.map(item => (
                    <div key={item.id} className="flex gap-4 items-start">
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        <img src={item.product.thumbnail} alt={item.product.name}
                          className="w-full h-full object-cover"
                          onError={e => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-3xl">📦</div>';
                          }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 line-clamp-2">{item.product.name}</h3>
                        <p className="text-sm text-gray-600">₩{item.product.price.toLocaleString()} x {item.quantity}개</p>
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <p className="font-bold text-gray-900">₩{(item.product.price * item.quantity).toLocaleString()}</p>
                        {cartItems.length > 1 && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (user && !item.id.startsWith('guest-') && !item.id.startsWith('buynow-')) {
                                try {
                                  await fetch(`/api/cart?productId=${item.productId}`, {
                                    method: 'DELETE',
                                    credentials: 'include',
                                  });
                                } catch {}
                              } else if (!user) {
                                removeFromGuestCart(item.productId);
                              }
                              setCartItems(prev => prev.filter(ci => ci.id !== item.id));
                            }}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 비회원 약관 동의 */}
              {isGuest && (
                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                    <span>📋</span> 약관 동의
                  </h2>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={agreeTerms && agreePrivacy}
                        onChange={e => { setAgreeTerms(e.target.checked); setAgreePrivacy(e.target.checked); }}
                        className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-sm font-bold text-gray-900">전체 동의</span>
                    </label>
                    <div className="border-t pt-3 space-y-3 pl-8">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)}
                          className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm text-gray-700">
                          [필수] 이용약관 동의
                          <Link href="/terms" className="text-blue-600 hover:underline ml-1" target="_blank">보기</Link>
                        </span>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={agreePrivacy} onChange={e => setAgreePrivacy(e.target.checked)}
                          className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm text-gray-700">
                          [필수] 개인정보 수집 및 이용 동의
                          <Link href="/privacy" className="text-blue-600 hover:underline ml-1" target="_blank">보기</Link>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 결제 정보 */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-4 sm:p-6 sticky top-20 sm:top-4 space-y-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">결제 정보</h2>

                {/* 쿠폰 입력 */}
                <CouponInput
                  totalAmount={totalAmount}
                  onApply={setAppliedCoupon}
                  appliedCoupon={appliedCoupon}
                />

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between text-gray-600">
                    <span>상품 금액</span>
                    <span>₩{totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>배송비</span>
                    <span>{shippingFee === 0 ? <span className="text-green-600 font-medium">무료</span> : `₩${shippingFee.toLocaleString()}`}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>쿠폰 할인</span>
                      <span className="font-medium">-₩{couponDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  {totalAmount >= 50000 && (
                    <p className="text-xs text-green-600 font-semibold">무료배송 적용!</p>
                  )}
                  <div className="border-t pt-3 flex justify-between text-xl font-bold text-gray-900">
                    <span>총 결제 금액</span>
                    <span className="text-blue-600">₩{finalAmount.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || (isGuest && (!agreeTerms || !agreePrivacy))}
                  className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      결제 처리 중...
                    </span>
                  ) : (
                    `₩${finalAmount.toLocaleString()} 결제하기`
                  )}
                </button>

                <div className="pt-4 border-t text-xs text-gray-500 space-y-1">
                  <p>결제는 Toss Payments로 안전하게 처리됩니다</p>
                  <p>주문 후 2-3일 이내 배송</p>
                  <p>교환/반품 가능 (7일 이내)</p>
                  {isGuest && (
                    <>
                      <p className="text-orange-600 font-medium mt-2">비회원 주문은 주문번호와 연락처로 조회 가능합니다</p>
                      <p className="text-orange-600 font-medium">회원가입 시 더 많은 혜택을 누리실 수 있습니다</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
