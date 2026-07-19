'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * [v1.0.22] KISPG PG 중단 → 잔액(KRW/QKEY) 결제 전환
 *
 * 기존 KISPG 결제창 대기/자동 submit 페이지를 폐지.
 * 잔액 결제는 결제창이 없으므로 이 페이지에 도달할 일이 없으나,
 * 과거 링크/북마크/외부 진입 방어를 위해 안전하게 리다이렉트한다.
 */
function PaymentWaitingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  useEffect(() => {
    try {
      sessionStorage.removeItem('kispgFormData');
    } catch {}

    // 주문 상태를 확인해 결제 완료면 주문내역, 아니면 장바구니로 유도
    if (orderId) {
      fetch(`/api/orders/status?orderId=${encodeURIComponent(orderId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && data?.data?.isPaid) {
            router.replace('/my-orders');
          } else {
            router.replace('/cart');
          }
        })
        .catch(() => router.replace('/cart'));
    } else {
      router.replace('/cart');
    }
  }, [orderId, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">이동 중입니다...</p>
      </div>
    </div>
  );
}

export default function PaymentWaitingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">로딩 중...</p>
        </div>
      </div>
    }>
      <PaymentWaitingContent />
    </Suspense>
  );
}
