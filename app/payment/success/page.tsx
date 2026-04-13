'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { clearGuestCart } from '@/lib/utils/guestCart';

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [isGuest, setIsGuest] = useState(false);

  // KISPG 결제 완료 후 파라미터
  const orderId = searchParams.get('orderId');
  const orderNumber = searchParams.get('orderNumber');
  const amount = searchParams.get('amount');
  const tid = searchParams.get('tid');
  const payMethod = searchParams.get('payMethod');
  const appNo = searchParams.get('appNo');

  // Toss 호환 (기존 파라미터)
  const paymentKey = searchParams.get('paymentKey');

  useEffect(() => {
    if (!orderId) {
      alert('잘못된 접근입니다');
      router.push('/');
      return;
    }

    // KISPG 결제의 경우: 승인이 이미 return route에서 처리되었으므로
    // 별도 verify 없이 바로 주문 정보 표시
    if (tid || orderNumber) {
      handleKispgSuccess();
    } else if (paymentKey && amount) {
      // Toss Payments 결제 (레거시 호환)
      verifyTossPayment();
    } else {
      // orderId만 있는 경우: DB에서 직접 조회
      fetchOrderInfo();
    }
  }, []);

  // KISPG 결제 성공 처리
  const handleKispgSuccess = async () => {
    try {
      const guestToken = localStorage.getItem('guestOrderToken');
      setIsGuest(!!guestToken);

      setOrderInfo({
        orderNumber: orderNumber || '',
        amount: amount ? parseInt(amount) : 0,
        paymentKey: tid || '',
        method: payMethodToKorean(payMethod || 'card'),
        appNo: appNo || '',
      });

      setIsLoading(false);

      // 장바구니 비우기
      if (guestToken) {
        clearGuestCart();
      } else {
        await fetch('/api/cart', {
          method: 'DELETE',
          credentials: 'include',
        }).catch(() => {});
      }
    } catch (error: any) {
      console.error('KISPG success handling error:', error);
      setIsLoading(false);
    }
  };

  // DB에서 주문 정보 직접 조회
  const fetchOrderInfo = async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const order = data.data || data.order;
        if (order) {
          setOrderInfo({
            orderNumber: order.orderNumber,
            amount: order.total,
            method: order.paymentMethod || '카드',
          });
          setIsGuest(!order.userId);
        }
      }
    } catch (err) {
      console.error('Order fetch error:', err);
    }
    setIsLoading(false);
  };

  // Toss Payments 결제 검증 (기존 호환)
  const verifyTossPayment = async () => {
    try {
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId, paymentKey, amount: parseInt(amount || '0') })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '결제 검증에 실패했습니다');
      }

      const guestToken = localStorage.getItem('guestOrderToken');
      setIsGuest(!!guestToken && !data.order.userId);

      setOrderInfo({
        orderNumber: data.order.orderNumber,
        amount: data.order.total,
        paymentKey: data.payment.paymentKey,
        method: data.payment.method,
        approvedAt: data.payment.approvedAt
      });

      setIsLoading(false);

      if (guestToken) {
        clearGuestCart();
      } else {
        await fetch('/api/cart', {
          method: 'DELETE',
          credentials: 'include',
        }).catch(() => {});
      }
    } catch (error: any) {
      console.error('Payment verification error:', error);
      alert(error.message || '결제 검증에 실패했습니다');
      router.push('/products');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">결제를 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        {/* 성공 아이콘 */}
        <div className="text-center mb-8">
          <div className="inline-block p-6 bg-green-100 rounded-full mb-4">
            <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">결제 완료!</h1>
          <p className="text-gray-600">주문이 성공적으로 처리되었습니다</p>
        </div>

        {/* 주문 정보 */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="space-y-4">
            <div className="flex justify-between border-b pb-3">
              <span className="text-gray-500">주문번호</span>
              <span className="font-bold text-gray-900">{orderInfo?.orderNumber}</span>
            </div>
            <div className="flex justify-between border-b pb-3">
              <span className="text-gray-500">결제수단</span>
              <span className="text-gray-900">{orderInfo?.method || '카드'}</span>
            </div>
            {orderInfo?.appNo && (
              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">승인번호</span>
                <span className="font-mono text-gray-900">{orderInfo.appNo}</span>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <span className="text-gray-500 text-lg">결제 금액</span>
              <span className="text-2xl font-bold text-blue-600">
                ₩{orderInfo?.amount?.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 안내 메시지 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <h3 className="text-blue-800 font-semibold mb-2">배송 안내</h3>
          <ul className="space-y-1.5 text-blue-700 text-sm">
            <li>• 상품은 영업일 기준 2-3일 내에 배송됩니다</li>
            <li>• 배송 조회는 마이페이지 &gt; 주문 내역에서 가능합니다</li>
            {isGuest && (
              <li className="text-orange-600 font-medium">• 비회원 주문 조회: 주문번호와 연락처로 조회 가능합니다</li>
            )}
          </ul>
        </div>

        {/* 비회원 주문 정보 알림 */}
        {isGuest && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 mb-6">
            <h3 className="text-orange-800 font-semibold mb-2">비회원 주문 안내</h3>
            <p className="text-sm text-orange-700 mb-3">
              주문번호 <span className="font-bold">{orderInfo?.orderNumber}</span>를 기억해주세요.
              주문 조회 시 필요합니다.
            </p>
            <Link 
              href="/register"
              className="inline-flex items-center gap-1 text-sm font-bold text-orange-600 hover:text-orange-700"
            >
              회원가입하면 더 많은 혜택을 받을 수 있어요 →
            </Link>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3">
          {isGuest ? (
            <>
              <Link
                href="/orders/lookup"
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-center transition shadow-sm"
              >
                주문 조회하기
              </Link>
              <Link
                href="/products"
                className="flex-1 py-4 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-center transition border border-gray-300"
              >
                쇼핑 계속하기
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/my-orders"
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-center transition shadow-sm"
              >
                주문 내역 보기
              </Link>
              <Link
                href="/products"
                className="flex-1 py-4 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-center transition border border-gray-300"
              >
                쇼핑 계속하기
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function payMethodToKorean(method: string): string {
  const map: Record<string, string> = {
    card: '신용카드', CARD: '신용카드',
    bank: '계좌이체', BANK: '계좌이체',
    vacnt: '가상계좌', VACNT: '가상계좌',
    hp: '휴대폰결제', HP: '휴대폰결제',
  };
  return map[method] || method;
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">로딩 중...</p>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
