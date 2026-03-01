export const dynamic = 'force-dynamic';

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function OrderSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [confirming, setConfirming] = useState(true);
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState('');

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey');
    const orderIdParam = searchParams.get('orderId');
    const amount = searchParams.get('amount');

    // Toss Payments 승인 파라미터가 있으면 결제 승인 진행
    if (paymentKey && orderIdParam && amount) {
      confirmPayment(paymentKey, orderIdParam, Number(amount));
    } else {
      // 승인 파라미터가 없으면 일반 주문 완료
      const directOrderId = searchParams.get('orderId');
      setOrderId(directOrderId || '');
      setConfirming(false);
    }
  }, [searchParams]);

  const confirmPayment = async (paymentKey: string, orderNumber: string, amount: number) => {
    try {
      const response = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentKey, orderId: orderNumber, amount }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '결제 승인에 실패했습니다.');
      }

      const data = await response.json();
      setOrderId(orderNumber);
      setConfirming(false);
    } catch (err) {
      console.error('Payment confirmation error:', err);
      setError(err instanceof Error ? err.message : '결제 승인 중 오류가 발생했습니다.');
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">결제를 승인하는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">결제 승인 실패</h1>
          <p className="text-gray-600 mb-6">{error}</p>

          <div className="space-y-3">
            <Link
              href="/cart"
              className="block w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              장바구니로 돌아가기
            </Link>
            <Link
              href="/products"
              className="block w-full px-6 py-3 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition"
            >
              쇼핑 계속하기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">주문이 완료되었습니다!</h1>
        <p className="text-gray-600 mb-6">
          결제가 성공적으로 처리되었습니다.<br />
          빠른 시일 내에 배송해드리겠습니다.
        </p>

        <div className="space-y-3">
          <Link
            href="/orders"
            className="block w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            주문 내역 보기
          </Link>
          <Link
            href="/products"
            className="block w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
          >
            쇼핑 계속하기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
}
