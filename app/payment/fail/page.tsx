'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * [v1.0.22] KISPG PG 중단 → 잔액(KRW/QKEY) 결제 전환
 *
 * 기존 KISPG 카드결제 실패/재시도 페이지를 폐지.
 * 사용자에게 PG 관련 문구(카드 한도/카드정보/결제창 등)를 일절 노출하지 않고,
 * 잔액 결제 안내 및 주문내역으로 유도한다. KISPG 결제 재요청 로직 제거.
 */
function PaymentFailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('orderId');

  useEffect(() => {
    // 과거 KISPG 세션 마커 잔재 정리
    try {
      sessionStorage.removeItem('kispgFormData');
    } catch {}

    // orderId가 있으면 실제 주문 상태를 확인해 이미 처리된 주문이면 주문내역으로 유도
    if (orderId) {
      fetch(`/api/orders/status?orderId=${encodeURIComponent(orderId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && data?.data?.isPaid) {
            router.replace('/my-orders');
          }
        })
        .catch(() => {});
    }
  }, [orderId, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="inline-block p-6 bg-yellow-100 rounded-full mb-4">
            <svg className="w-16 h-16 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">주문이 완료되지 않았습니다</h1>
          <p className="text-gray-600">잔액 결제로 다시 진행해주세요</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <h3 className="text-blue-800 font-semibold mb-2">결제 안내</h3>
          <ul className="space-y-1.5 text-blue-700 text-sm">
            <li>• 결제는 <b>KRW 잔액</b> 또는 <b>QKEY 잔액</b>으로 진행됩니다.</li>
            <li>• 잔액이 부족하면 마이페이지 &gt; 잔액에서 충전 후 이용해주세요.</li>
            <li>• 문제가 계속되면 고객센터로 문의해주세요.</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/my/balance"
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-center transition shadow-sm"
          >
            잔액 충전하기
          </Link>
          <Link
            href="/cart"
            className="flex-1 py-4 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-center transition border border-gray-300"
          >
            장바구니로 이동
          </Link>
        </div>

        <div className="mt-4 text-center">
          <Link href="/my-orders" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            주문 내역에서 확인하기 →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">로딩 중...</p>
        </div>
      </div>
    }>
      <PaymentFailContent />
    </Suspense>
  );
}
