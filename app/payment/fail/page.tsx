'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * [BUG FIX 2026-04-30]
 * 결제 실패 페이지에 "주문 상태 자동 확인" 기능 추가
 * 
 * 문제: KISPG 승인 API가 에러(MOID 중복 등)를 반환해도 실제 카드 결제는 성공한 경우가 있음
 *       → 사용자가 "결제 실패" 화면을 보지만 실제로는 돈이 빠져나감
 * 
 * 해결: 실패 페이지 로드 시 서버에서 주문 상태를 재확인
 *       → CONFIRMED/SHIPPING/DELIVERED이면 자동으로 성공 페이지로 이동
 *       → PENDING이면 일정 시간 후 한 번 더 재확인 (승인 처리 지연 대응)
 */
function PaymentFailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const code = searchParams.get('code');
  const message = searchParams.get('message');
  const orderId = searchParams.get('orderId');

  const [verifying, setVerifying] = useState(!!orderId); // orderId가 있으면 자동 확인 시작
  const [verifyMessage, setVerifyMessage] = useState('결제 상태를 확인하고 있습니다...');

  // ★ 페이지 로드 시 주문 상태를 서버에서 재확인
  useEffect(() => {
    if (!orderId) {
      setVerifying(false);
      return;
    }

    let cancelled = false;

    const verifyOrderStatus = async (attempt: number) => {
      try {
        // ★ 경량 주문 상태 확인 API 사용 (인증 불필요 → 회원/비회원 모두 지원)
        const res = await fetch(`/api/orders/status?orderId=${encodeURIComponent(orderId)}`);

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            const order = data.data;

            if (order.isPaid) {
              // ★ 결제가 실제로 완료됨! → 성공 페이지로 자동 이동
              if (!cancelled) {
                setVerifyMessage('결제가 정상 처리된 것을 확인했습니다! 이동 중...');
                setTimeout(() => {
                  const successUrl = new URL('/payment/success', window.location.origin);
                  successUrl.searchParams.set('orderId', orderId);
                  successUrl.searchParams.set('orderNumber', order.orderNumber || '');
                  successUrl.searchParams.set('amount', Math.round(order.total || 0).toString());
                  successUrl.searchParams.set('tid', order.paymentKey || '');
                  successUrl.searchParams.set('payMethod', order.paymentMethod || 'card');
                  router.replace(successUrl.pathname + successUrl.search);
                }, 1000);
              }
              return; // 성공 확인 → 더 이상 재시도 불필요
            }

            // PENDING 상태이고 첫 번째 시도인 경우 → 3초 후 한 번 더 확인
            // (승인 API 처리 지연 가능성)
            if (order.status === 'PENDING' && attempt === 1) {
              if (!cancelled) {
                setVerifyMessage('결제 처리 중입니다. 잠시만 기다려주세요...');
                setTimeout(() => {
                  if (!cancelled) verifyOrderStatus(2);
                }, 3000);
              }
              return;
            }
          }
        }
      } catch (err) {
        console.error('주문 상태 확인 실패:', err);
      }

      // 확인 완료 → 실제로 실패한 것으로 판단
      if (!cancelled) {
        setVerifying(false);
      }
    };

    verifyOrderStatus(1);

    return () => { cancelled = true; };
  }, [orderId, router]);

  // 결제 재시도: PENDING 상태의 주문이 있으면 KISPG 결제 재요청
  const handleRetryPayment = async () => {
    if (!orderId) {
      // orderId가 없으면 장바구니로 이동
      window.location.href = '/cart';
      return;
    }

    try {
      const res = await fetch('/api/payments/kispg/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        // 이미 결제 완료된 주문인 경우 → 성공 페이지로 유도
        if (errData.error?.includes('이미 결제') || errData.error?.includes('완료된 주문')) {
          const successUrl = `/payment/success?orderId=${orderId}`;
          router.replace(successUrl);
          return;
        }
        alert(errData.error || '결제 재시도에 실패했습니다. 장바구니에서 다시 주문해주세요.');
        window.location.href = '/cart';
        return;
      }

      const kispgData = await res.json();
      if (!kispgData.success || !kispgData.authUrl || !kispgData.formData) {
        alert('결제 데이터를 가져오지 못했습니다. 장바구니에서 다시 주문해주세요.');
        window.location.href = '/cart';
        return;
      }

      // 동적 form 생성 후 KISPG 결제창으로 POST submit
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = kispgData.authUrl;
      form.acceptCharset = 'utf-8';
      form.style.display = 'none';
      form.target = '_self';

      Object.entries(kispgData.formData).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(value);
        form.appendChild(input);
      });

      document.body.appendChild(form);
      setTimeout(() => form.submit(), 100);
    } catch (error) {
      console.error('결제 재시도 실패:', error);
      alert('결제 재시도 중 오류가 발생했습니다.');
      window.location.href = '/cart';
    }
  };

  // 주문 상태 확인 중 로딩 화면
  if (verifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          <div className="inline-block p-6 bg-blue-100 rounded-full mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">{verifyMessage}</h1>
          <p className="text-gray-500 text-sm">결제 결과를 서버에서 확인하고 있습니다. 잠시만 기다려주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        {/* 실패 아이콘 */}
        <div className="text-center mb-8">
          <div className="inline-block p-6 bg-red-100 rounded-full mb-4">
            <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">결제 실패</h1>
          <p className="text-gray-600">결제 처리 중 문제가 발생했습니다</p>
        </div>

        {/* 에러 정보 */}
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6 mb-6">
          <div className="space-y-4">
            {code && (
              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">에러 코드</span>
                <span className="font-mono text-red-600">{code}</span>
              </div>
            )}
            <div>
              <span className="text-gray-500 block mb-2">에러 메시지</span>
              <p className="text-gray-900 bg-red-50 p-3 rounded-lg text-sm">
                {message || '알 수 없는 오류가 발생했습니다'}
              </p>
            </div>
          </div>
        </div>

        {/* 안내 메시지 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mb-6">
          <h3 className="text-yellow-800 font-semibold mb-2">확인해주세요</h3>
          <ul className="space-y-1.5 text-yellow-700 text-sm">
            <li>• 카드 한도가 충분한지 확인해주세요</li>
            <li>• 카드 정보가 정확한지 다시 확인해주세요</li>
            <li>• 일시적인 오류일 수 있으니 잠시 후 다시 시도해주세요</li>
            <li>• 문제가 계속되면 고객센터로 문의해주세요</li>
          </ul>
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleRetryPayment}
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-center transition shadow-sm"
          >
            다시 결제하기
          </button>
          <Link
            href="/products"
            className="flex-1 py-4 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-center transition border border-gray-300"
          >
            쇼핑 계속하기
          </Link>
        </div>

        {/* 주문 내역 확인 링크 */}
        {orderId && (
          <div className="mt-4 text-center">
            <Link
              href="/my-orders"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              주문 내역에서 확인하기 →
            </Link>
          </div>
        )}

        {/* 고객센터 */}
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            문의사항이 있으신가요?{' '}
            <Link href="/support" className="text-blue-600 hover:text-blue-700 font-medium">
              고객센터
            </Link>
          </p>
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
