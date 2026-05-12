'use client';

/**
 * [2026-05-12 v1.0.17 HOTFIX] payment/success 전용 error boundary
 *
 * 배경:
 *   - PC 카드결제 후 /payment/success 에서 어떤 throw 가 발생하면 app/error.tsx (global) 가 트리거
 *     → 흰 창 + "😢 오류가 발생했습니다" 표시 → 사장님 사고 보고
 *
 * 목적:
 *   - payment/success 페이지에서의 모든 throw 를 이 경계에서 흡수
 *   - 사용자에게는 "결제는 정상 처리됐으니 주문내역을 확인해주세요" 안내 표시
 *   - 결제가 이미 끝난 상황이므로 사용자 혼동 최소화
 *
 * Next.js App Router 규약:
 *   - 같은 디렉토리에 error.tsx 가 있으면 해당 segment 의 throw 를 우선 처리
 *   - app/error.tsx (global) 보다 우선
 */

import { useEffect } from 'react';
import Link from 'next/link';

export default function PaymentSuccessError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[payment/success] segment error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
        <div className="inline-block p-5 bg-green-100 rounded-full mb-4">
          <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          결제가 정상 처리되었습니다
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          결제 정보 화면을 표시하는 중에 일시적인 문제가 발생했습니다.
          <br />
          주문 내역에서 결제 결과를 확인하실 수 있습니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/my-orders"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition"
          >
            주문 내역 보기
          </Link>
          <button
            onClick={() => reset()}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition"
          >
            다시 시도
          </button>
        </div>
        <div className="mt-6">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            홈으로 →
          </Link>
        </div>
      </div>
    </div>
  );
}
