'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function PaymentFailContent() {
  const searchParams = useSearchParams();

  const code = searchParams.get('code');
  const message = searchParams.get('message');

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
          <Link
            href="/checkout"
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-center transition shadow-sm"
          >
            다시 결제하기
          </Link>
          <Link
            href="/products"
            className="flex-1 py-4 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-center transition border border-gray-300"
          >
            쇼핑 계속하기
          </Link>
        </div>

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
