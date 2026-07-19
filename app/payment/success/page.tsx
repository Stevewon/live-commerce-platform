'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { clearGuestCart } from '@/lib/utils/guestCart';

/**
 * [v1.0.22] KISPG PG 중단 → 잔액(KRW/QKEY) 결제 전환
 *
 * 신규 잔액 결제 성공 흐름은 /orders/success 를 사용한다.
 * 이 페이지는 과거 KISPG 결제 성공 링크/북마크 방어용으로만 유지하며,
 * PG(카드/결제창/승인) 관련 문구와 KISPG sync 호출을 모두 제거했다.
 * orderId 가 있으면 안전한 주문 상태 API 로만 확인 후 완료 화면을 보여준다.
 */
function safeGet(sp: ReturnType<typeof useSearchParams>, key: string): string {
  try {
    return sp?.get(key) || '';
  } catch {
    return '';
  }
}

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState<any>(null);

  const orderId = safeGet(searchParams, 'orderId');
  const orderNumber = safeGet(searchParams, 'orderNumber');

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.removeItem('kispgFormData');
        } catch {}
        try {
          clearGuestCart();
        } catch {}
      }

      if (!orderId && !orderNumber) {
        setIsLoading(false);
        return;
      }

      // 안전한 주문 상태 조회 (PG 승인/동기화 호출 없음)
      if (orderId) {
        fetch(`/api/orders/status?orderId=${encodeURIComponent(orderId)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.success && data?.data) setOrderInfo(data.data);
            setIsLoading(false);
          })
          .catch(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    } catch {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">주문 정보를 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  const displayOrderNumber = orderInfo?.orderNumber || orderNumber || '';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="inline-block p-6 bg-green-100 rounded-full mb-4">
            <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">주문이 완료되었습니다</h1>
          <p className="text-gray-600">잔액 결제가 정상적으로 처리되었습니다</p>
        </div>

        {displayOrderNumber && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-500">주문번호</span>
              <span className="font-mono font-semibold text-gray-900">{displayOrderNumber}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
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
        </div>
      </div>
    </div>
  );
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
