'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function PaymentFailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const code = searchParams.get('code');
  const message = searchParams.get('message');

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        {/* 실패 아이콘 */}
        <div className="text-center mb-8">
          <div className="inline-block p-6 bg-red-500/20 rounded-full mb-4">
            <svg className="w-24 h-24 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold mb-2">결제 실패</h1>
          <p className="text-gray-400 text-lg">결제 처리 중 문제가 발생했습니다</p>
        </div>

        {/* 에러 정보 */}
        <div className="bg-gray-800/50 rounded-2xl border border-red-500/30 p-8 mb-6">
          <div className="space-y-4">
            {code && (
              <div className="flex justify-between border-b border-gray-700 pb-4">
                <span className="text-gray-400">에러 코드</span>
                <span className="font-mono text-red-400">{code}</span>
              </div>
            )}
            <div>
              <span className="text-gray-400 block mb-2">에러 메시지</span>
              <p className="text-white bg-red-500/10 p-4 rounded-lg">
                {message || '알 수 없는 오류가 발생했습니다'}
              </p>
            </div>
          </div>
        </div>

        {/* 안내 메시지 */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 mb-8">
          <h3 className="text-yellow-400 font-semibold mb-2">💡 다음 사항을 확인해주세요</h3>
          <ul className="space-y-2 text-gray-300 text-sm">
            <li>• 카드 한도가 충분한지 확인해주세요</li>
            <li>• 카드 정보가 정확한지 다시 확인해주세요</li>
            <li>• 일시적인 오류일 수 있으니 잠시 후 다시 시도해주세요</li>
            <li>• 문제가 계속되면 고객센터로 문의해주세요</li>
          </ul>
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/checkout"
            className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-bold text-center transition-all transform hover:scale-105 shadow-lg"
          >
            다시 결제하기
          </Link>
          <Link
            href="/cart"
            className="flex-1 py-4 bg-gray-700/50 hover:bg-gray-700 text-white rounded-xl font-bold text-center transition-all border border-gray-600"
          >
            장바구니로 돌아가기
          </Link>
        </div>

        {/* 고객센터 */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            문의사항이 있으신가요?{' '}
            <Link href="/support" className="text-blue-400 hover:text-blue-300 underline">
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400 text-xl">로딩 중...</p>
        </div>
      </div>
    }>
      <PaymentFailContent />
    </Suspense>
  );
}
