'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import ShopNavigation from '@/components/ShopNavigation';

export default function ProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Product page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50">
      <ShopNavigation />
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <span className="text-6xl block mb-6">😢</span>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          상품 페이지 오류
        </h1>
        <p className="text-gray-500 mb-6">
          상품 정보를 불러오는 중 문제가 발생했습니다.
          <br />
          잠시 후 다시 시도해주세요.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition"
          >
            다시 시도
          </button>
          <Link
            href="/products"
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition"
          >
            상품 목록으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
