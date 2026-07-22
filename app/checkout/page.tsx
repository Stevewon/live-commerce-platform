'use client';
import { useAuth } from '@/lib/contexts/AuthContext'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// [v1.0.22] KISPG PG 중단 → KRW/QKEY 잔액 결제로 전환
import ShopNavigation from '@/components/ShopNavigation';
import { getGuestCart, clearGuestCart, removeFromGuestCart, GuestCartItem } from '@/lib/utils/guestCart';
import AddressSearch from '@/components/AddressSearch';
import CouponInput from '@/components/CouponInput';
import { authFetch } from '@/lib/auth/clientFetch';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { proxyImg } from '@/lib/utils/imgProxy';

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
  const { t } = useLanguage();
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

  // [v1.0.22] 잔액 결제 (KRW / QKEY / SPLIT: 쿠키+현금 병행)
  const [paymentMethod, setPaymentMethod] = useState<'KRW_BALANCE' | 'QKEY_BALANCE' | 'SPLIT_BALANCE'>('KRW_BALANCE');
  const [balance, setBalance] = useState<{ krwBalance: number; qkeyBalance: number } | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  // 병행결제: 사용자가 쿠키(QKEY)를 얼마나 쓸지 (개수). 나머지는 현금(KRW) 잔액으로 자동 결제.
  const [splitQkey, setSplitQkey] = useState<number>(0);

  // 파트너 스토어 경유 정보
  const [storePartnerId, setStorePartnerId] = useState<string | null>(null);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);

  // 동적 배송비 설정
  const [shippingConfig, setShippingConfig] = useState({ shippingFee: 3000, freeShippingThreshold: 50000 });

  // 배송 메모 프리셋 (value = 직접입력 여부 판별용 키, label = 다국어 표시)
  const MEMO_PRESETS = [
    { key: 'direct', label: t.checkout.memoDirect },
    { key: 'door', label: t.checkout.memoDoor },
    { key: 'security', label: t.checkout.memoSecurity },
    { key: 'callBefore', label: t.checkout.memoCallBefore },
    { key: 'absentSecurity', label: t.checkout.memoAbsentSecurity },
  ];
  const [memoPreset, setMemoPreset] = useState('direct');

  // 배송비 설정 로드
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

  // [v1.0.22] 로그인 사용자 잔액 로드 (KRW / QKEY)
  useEffect(() => {
    if (authLoading || !user) return;
    setBalanceLoading(true);
    authFetch('/api/my/balance')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setBalance({
            krwBalance: Number(data.data.krwBalance) || 0,
            qkeyBalance: Number(data.data.qkeyBalance) || 0,
          });
        }
      })
      .catch(() => {})
      .finally(() => setBalanceLoading(false));
  }, [user, authLoading]);

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
      const res = await authFetch('/api/cart');
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
  const shippingFee = shippingConfig.freeShippingThreshold > 0 && totalAmount >= shippingConfig.freeShippingThreshold ? 0 : shippingConfig.shippingFee;
  const couponDiscount = appliedCoupon?.discountAmount || 0;
  const finalAmount = Math.max(0, totalAmount + shippingFee - couponDiscount);

  const handleAddressComplete = (data: { zipCode: string; address: string }) => {
    setShippingZipCode(data.zipCode);
    setShippingAddress(data.address);
  };

  // [v1.0.22] QKEY 환율: 1 QKEY = 10원
  const QKEY_RATE = 10;
  const requiredQkey = Math.ceil(finalAmount / QKEY_RATE);
  const krwEnough = !!balance && balance.krwBalance >= finalAmount;
  const qkeyEnough = !!balance && balance.qkeyBalance >= requiredQkey;

  // ── [병행결제] 쿠키+현금 분할 계산 ──
  // splitQkey: 사용자가 쓰려는 쿠키 개수. 실제 사용 가능한 최대치는
  //   (1) 보유 쿠키 잔액, (2) 결제금액을 쿠키로 환산한 값 중 작은 값.
  const maxSplitQkey = Math.min(
    balance?.qkeyBalance ?? 0,
    Math.floor(finalAmount / QKEY_RATE) // 결제금액을 넘겨 쓰지 않도록 내림
  );
  // 실제 반영되는 쿠키 사용량 (범위 clamp)
  const usedQkey = Math.max(0, Math.min(splitQkey, maxSplitQkey));
  // 쿠키로 충당한 금액 (원)
  const qkeyPaidKrw = usedQkey * QKEY_RATE;
  // 나머지는 현금(KRW) 잔액으로 결제
  const splitKrwRemainder = Math.max(0, finalAmount - qkeyPaidKrw);
  const splitKrwEnough = !!balance && balance.krwBalance >= splitKrwRemainder;
  const splitEnough = !!balance && usedQkey <= (balance.qkeyBalance ?? 0) && splitKrwEnough;

  const selectedEnough =
    paymentMethod === 'KRW_BALANCE' ? krwEnough
    : paymentMethod === 'QKEY_BALANCE' ? qkeyEnough
    : splitEnough;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // [v1.0.22] 잔액 결제는 회원 전용
    if (isGuest || !user) {
      alert(t.checkout.balanceLoginAlert);
      router.push('/login?redirect=/checkout');
      return;
    }

    if (!shippingName || !shippingPhone || !shippingAddress) {
      alert(t.checkout.fillShipping);
      return;
    }
    if (cartItems.length === 0) {
      alert(t.checkout.cartEmpty);
      return;
    }

    // [v1.0.22] 잔액 부족 사전 차단 (서버에서도 재검증됨)
    if (!selectedEnough) {
      const label = paymentMethod === 'KRW_BALANCE' ? t.checkout.krwBalance : t.checkout.qkeyBalance;
      if (confirm(`${label}${t.checkout.insufficientConfirm}`)) {
        router.push('/my/balance');
      }
      return;
    }
    if (isGuest) {
      if (!guestEmail && !guestPhone) {
        alert(t.checkout.guestContactRequired);
        return;
      }
      if (!agreeTerms || !agreePrivacy) {
        alert(t.checkout.agreeRequired);
        return;
      }
    }

    try {
      setSubmitting(true);
      const fullAddress = shippingAddressDetail
        ? `${shippingAddress} ${shippingAddressDetail}`
        : shippingAddress;

      const finalMemo = memoPreset !== 'direct'
        ? (MEMO_PRESETS.find(m => m.key === memoPreset)?.label || shippingMemo)
        : shippingMemo;

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
        // [v1.0.22] 잔액 결제수단: KRW_BALANCE | QKEY_BALANCE | SPLIT_BALANCE
        paymentMethod,
        shippingFee,
      };

      // [병행결제] SPLIT_BALANCE 인 경우 사용할 쿠키 개수 전달
      if (paymentMethod === 'SPLIT_BALANCE') {
        orderData.splitQkey = usedQkey; // 서버가 나머지는 현금으로 자동 차감
      }

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

      // [v1.0.22] 주문 생성 = 잔액 즉시 차감 + 즉시 CONFIRMED (PG 없음)
      const res = await authFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify(orderData),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        // 402: 잔액 부족 → 충전 페이지 유도
        if (res.status === 402 || result.code === 'INSUFFICIENT_BALANCE') {
          if (confirm((result.error || t.checkout.insufficientBalance) + '\n\n' + t.checkout.insufficientMoveConfirm)) {
            router.push('/my/balance');
          }
          return;
        }
        // 401: 로그인 필요
        if (res.status === 401 || result.code === 'AUTH_REQUIRED') {
          alert(result.error || t.checkout.loginRequired);
          router.push('/login?redirect=/checkout');
          return;
        }
        throw new Error(result.error || t.checkout.orderError);
      }

      const order = result.data;

      // 회원 장바구니 비우기 (bestselling: 서버 카트 clear 는 주문 생성 시 별도 처리 안 되므로 방어)
      try {
        clearGuestCart();
      } catch {}

      // 파트너 스토어 경유 정보 정리
      try {
        sessionStorage.removeItem('checkout_partnerId');
        sessionStorage.removeItem('checkout_storeSlug');
      } catch {}

      // 주문 성공 페이지로 이동 (잔액 결제는 즉시 확정)
      const successUrl = new URL('/orders/success', window.location.origin);
      if (order?.id) successUrl.searchParams.set('orderId', order.id);
      if (order?.orderNumber) successUrl.searchParams.set('orderNumber', order.orderNumber);
      window.location.replace(successUrl.toString());
      return;
    } catch (error: any) {
      console.error('order failed:', error);
      alert(error.message || t.checkout.orderError);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t.checkout.loadingOrder}</p>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl block mb-4">🛒</span>
          <h1 className="text-2xl font-bold mb-4">{t.checkout.emptyCart}</h1>
          <p className="text-gray-600 mb-6">{t.checkout.emptyCartDesc}</p>
          <Link href="/products" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition">
            {t.checkout.goShopping}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      <ShopNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex items-center gap-3 mb-4 sm:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{t.checkout.title}</h1>
          {isGuest && (
            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-bold">
              {t.checkout.guestOrder}
            </span>
          )}
        </div>

        {/* 파트너 스토어 경유 안내 */}
        {storePartnerId && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-2xl">🏪</span>
            <div>
              <p className="text-sm font-medium text-blue-700">{t.checkout.guestOrderVia}</p>
              {storeSlug && (
                <Link href={`/store/${storeSlug}`} className="text-xs text-blue-500 hover:underline">
                  {t.checkout.backToStore}
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
                      <h3 className="font-bold text-blue-900 mb-1">{t.checkout.guestOrderNotice}</h3>
                      <p className="text-sm text-blue-700 mb-3">
                        {t.checkout.guestOrderDesc}
                      </p>
                      <Link href="/login" className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700">
                        {t.checkout.memberLogin} →
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* 비회원 주문자 정보 */}
              {isGuest && (
                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                    <span>👤</span> {t.checkout.ordererInfo}
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email <span className="text-gray-400">({t.checkout.emailForOrder})</span>
                      </label>
                      <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)}
                        placeholder="example@email.com"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t.checkout.phone} <span className="text-red-500">*</span>
                      </label>
                      <input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)}
                        placeholder="010-0000-0000"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
                      <p className="text-xs text-gray-500 mt-1">{t.checkout.guestLookupHint}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 배송 정보 - 다음 우편번호 API 연동 */}
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <span>🚚</span> {t.checkout.deliveryInfo}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t.checkout.receiver} <span className="text-red-500">*</span>
                    </label>
                    <input type="text" value={shippingName} onChange={e => setShippingName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t.checkout.phone} <span className="text-red-500">*</span>
                    </label>
                    <input type="tel" value={shippingPhone} onChange={e => setShippingPhone(e.target.value)}
                      placeholder="010-0000-0000"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t.checkout.address} <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input type="text" value={shippingZipCode} readOnly
                        placeholder={t.checkout.zipCode}
                        className="w-32 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700" />
                      <AddressSearch onComplete={handleAddressComplete} />
                    </div>
                    <input type="text" value={shippingAddress} readOnly
                      placeholder={t.checkout.addressSearchHint}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 mb-2" />
                    <input type="text" value={shippingAddressDetail}
                      onChange={e => setShippingAddressDetail(e.target.value)}
                      placeholder={t.checkout.detailAddressPlaceholder}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.checkout.memo}</label>
                    <select
                      value={memoPreset}
                      onChange={e => {
                        setMemoPreset(e.target.value);
                        if (e.target.value !== 'direct') {
                          setShippingMemo(MEMO_PRESETS.find(m => m.key === e.target.value)?.label || '');
                        } else setShippingMemo('');
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-700 mb-2"
                    >
                      {MEMO_PRESETS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                    {memoPreset === 'direct' && (
                      <textarea value={shippingMemo} onChange={e => setShippingMemo(e.target.value)}
                        rows={2} placeholder={t.checkout.memoPlaceholder}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* 주문 상품 */}
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <span>📦</span> {t.checkout.orderProducts} ({cartItems.length}{t.checkout.itemsCount})
                </h2>
                <div className="space-y-4">
                  {cartItems.map(item => (
                    <div key={item.id} className="flex gap-4 items-start">
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        <img src={proxyImg(item.product.thumbnail)} alt={item.product.name}
                          loading="lazy" width={80} height={80}
                          className="w-full h-full object-cover"
                          onError={e => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-3xl">📦</div>';
                          }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 line-clamp-2">{item.product.name}</h3>
                        <p className="text-sm text-gray-600">₩{item.product.price.toLocaleString()} x {item.quantity}{t.checkout.itemsCount}</p>
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <p className="font-bold text-gray-900">₩{(item.product.price * item.quantity).toLocaleString()}</p>
                        {cartItems.length > 1 && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (user && !item.id.startsWith('guest-') && !item.id.startsWith('buynow-')) {
                                try {
                                  await authFetch(`/api/cart?productId=${item.productId}`, {
                                    method: 'DELETE',
                                  });
                                } catch {}
                              } else if (!user) {
                                removeFromGuestCart(item.productId);
                              }
                              setCartItems(prev => prev.filter(ci => ci.id !== item.id));
                            }}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            {t.checkout.delete}
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
                    <span>📋</span> {t.checkout.agreeTitle}
                  </h2>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={agreeTerms && agreePrivacy}
                        onChange={e => { setAgreeTerms(e.target.checked); setAgreePrivacy(e.target.checked); }}
                        className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-sm font-bold text-gray-900">{t.checkout.agreeAll}</span>
                    </label>
                    <div className="border-t pt-3 space-y-3 pl-8">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)}
                          className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm text-gray-700">
                          {t.checkout.agreeTermsRequired}
                          <Link href="/terms" className="text-blue-600 hover:underline ml-1" target="_blank">{t.checkout.view}</Link>
                        </span>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={agreePrivacy} onChange={e => setAgreePrivacy(e.target.checked)}
                          className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm text-gray-700">
                          {t.checkout.agreePrivacyRequired}
                          <Link href="/privacy" className="text-blue-600 hover:underline ml-1" target="_blank">{t.checkout.view}</Link>
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
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">{t.checkout.paymentInfo}</h2>

                {/* 쿠폰 입력 */}
                <CouponInput
                  totalAmount={totalAmount}
                  onApply={setAppliedCoupon}
                  appliedCoupon={appliedCoupon}
                />

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between text-gray-600">
                    <span>{t.checkout.productAmount}</span>
                    <span>₩{totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>{t.checkout.shippingFee}</span>
                    <span>{shippingFee === 0 ? <span className="text-green-600 font-medium">{t.checkout.free}</span> : `₩${shippingFee.toLocaleString()}`}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>{t.checkout.couponDiscount}</span>
                      <span className="font-medium">-₩{couponDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  {shippingFee === 0 && totalAmount > 0 && (
                    <p className="text-xs text-green-600 font-semibold">{t.checkout.freeShippingApplied}</p>
                  )}
                  <div className="border-t pt-3 flex justify-between text-xl font-bold text-gray-900">
                    <span>{t.checkout.finalAmount}</span>
                    <span className="text-blue-600">₩{finalAmount.toLocaleString()}</span>
                  </div>
                </div>

                {/* [v1.0.22] 잔액 결제수단 선택 */}
                {!isGuest && user ? (
                  <div className="pt-2 space-y-2">
                    <p className="text-sm font-semibold text-gray-800">{t.checkout.paymentMethod}</p>

                    {/* KRW 잔액 */}
                    <label className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${paymentMethod === 'KRW_BALANCE' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === 'KRW_BALANCE'}
                          onChange={() => setPaymentMethod('KRW_BALANCE')}
                          className="accent-blue-600"
                        />
                        <span className="text-sm font-medium text-gray-900">{t.checkout.krwBalance}</span>
                      </div>
                      <span className={`text-sm font-semibold ${krwEnough ? 'text-gray-700' : 'text-red-500'}`}>
                        {balanceLoading ? t.checkout.loadingBalance : `₩${(balance?.krwBalance ?? 0).toLocaleString()}`}
                      </span>
                    </label>

                    {/* QKEY 잔액 */}
                    <label className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${paymentMethod === 'QKEY_BALANCE' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === 'QKEY_BALANCE'}
                          onChange={() => setPaymentMethod('QKEY_BALANCE')}
                          className="accent-blue-600"
                        />
                        <span className="text-sm font-medium text-gray-900">{t.checkout.qkeyBalance}</span>
                      </div>
                      <span className={`text-sm font-semibold ${qkeyEnough ? 'text-gray-700' : 'text-red-500'}`}>
                        {balanceLoading ? t.checkout.loadingBalance : `${(balance?.qkeyBalance ?? 0).toLocaleString()} QKEY`}
                      </span>
                    </label>

                    {paymentMethod === 'QKEY_BALANCE' && (
                      <p className="text-xs text-gray-500">{t.checkout.requiredQkey}: {requiredQkey.toLocaleString()} QKEY ({t.checkout.qkeyRate})</p>
                    )}

                    {/* [병행결제] 쿠키 + 현금 병행 */}
                    <label className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${paymentMethod === 'SPLIT_BALANCE' ? 'border-purple-600 bg-purple-50' : 'border-gray-200'}`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === 'SPLIT_BALANCE'}
                          onChange={() => {
                            setPaymentMethod('SPLIT_BALANCE');
                            // 기본값: 가능한 만큼 쿠키를 먼저 사용
                            setSplitQkey(Math.min(balance?.qkeyBalance ?? 0, Math.floor(finalAmount / QKEY_RATE)));
                          }}
                          className="accent-purple-600"
                        />
                        <span className="text-sm font-medium text-gray-900">🍪 {t.checkout.splitPayment}</span>
                      </div>
                    </label>

                    {/* 병행결제 상세 입력 */}
                    {paymentMethod === 'SPLIT_BALANCE' && (
                      <div className="rounded-lg border border-purple-200 bg-purple-50/60 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-700">{t.checkout.useQkeyAmount}</label>
                          <span className="text-[11px] text-gray-500">{t.checkout.qkeyRate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={maxSplitQkey}
                            step={1}
                            value={usedQkey}
                            onChange={e => {
                              const v = Math.floor(Number(e.target.value) || 0);
                              setSplitQkey(Math.max(0, Math.min(v, maxSplitQkey)));
                            }}
                            className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                          />
                          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">쿠키</span>
                          <button
                            type="button"
                            onClick={() => setSplitQkey(maxSplitQkey)}
                            className="text-xs font-semibold text-purple-600 border border-purple-300 rounded px-2 py-1 whitespace-nowrap hover:bg-purple-100"
                          >
                            {t.checkout.useMax}
                          </button>
                        </div>
                        {/* 병행 결제 내역 요약 */}
                        <div className="text-xs text-gray-700 space-y-1 pt-1 border-t border-purple-200">
                          <div className="flex justify-between">
                            <span>🍪 {t.checkout.qkeyPortion}</span>
                            <span className="font-medium">{usedQkey.toLocaleString()} 쿠키 (₩{qkeyPaidKrw.toLocaleString()})</span>
                          </div>
                          <div className="flex justify-between">
                            <span>💰 {t.checkout.cashPortion}</span>
                            <span className={`font-medium ${splitKrwEnough ? 'text-gray-700' : 'text-red-500'}`}>₩{splitKrwRemainder.toLocaleString()}</span>
                          </div>
                          {!splitKrwEnough && (
                            <p className="text-[11px] text-red-500">{t.checkout.cashShortForSplit}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {!selectedEnough && !balanceLoading && (
                      <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg p-2">
                        <span className="text-xs text-red-600 font-medium">{t.checkout.insufficientBalance}</span>
                        <Link href="/my/balance" className="text-xs font-semibold text-blue-600 underline">{t.checkout.chargeBalance}</Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="pt-2 bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
                    {t.checkout.balanceLoginRequired}{' '}
                    <Link href="/login?redirect=/checkout" className="font-semibold underline">{t.checkout.login}</Link>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || isGuest || !user || balanceLoading}
                  className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      {t.checkout.paying}
                    </span>
                  ) : !selectedEnough && !isGuest && user && !balanceLoading ? (
                    t.checkout.chargeNeeded
                  ) : (
                    `₩${finalAmount.toLocaleString()} ${t.checkout.payAmount}`
                  )}
                </button>

                <div className="pt-4 border-t text-xs text-gray-500 space-y-1">
                  <p>{t.checkout.footerBalance}</p>
                  <p>{t.checkout.footerConfirm}</p>
                  <p>{t.checkout.footerShipping}</p>
                  <p>{t.checkout.footerReturn}</p>
                  <Link href="/my/balance" className="inline-block text-blue-600 font-medium underline mt-1">
                    {t.checkout.footerChargeLink} →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
