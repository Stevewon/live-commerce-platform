'use client';

import Link from 'next/link';

export default function OrderFailPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="text-6xl mb-4">❌</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">결제에 실패했습니다</h1>
        <p className="text-gray-600 mb-6">
          결제 처리 중 문제가 발생했습니다.<br />
          다시 시도해주세요.
        </p>

        <div className="space-y-3">
          <Link
            href="/cart"
            className="block w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            장바구니로 돌아가기
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
