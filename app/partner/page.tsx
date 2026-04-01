'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import Link from 'next/link';

export default function PartnerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role === 'PARTNER') {
      router.push('/partner/dashboard');
    }
  }, [user, loading]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  if (user?.role === 'PARTNER') {
    return <div className="min-h-screen flex items-center justify-center"><p>파트너 대시보드로 이동 중...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">QRLIVE 파트너센터</h1>
        <p className="text-gray-600 mb-8">QRLIVE와 함께 성장하세요. 파트너 입점으로 더 많은 고객을 만나보세요.</p>
        
        <div className="grid gap-6 md:grid-cols-3 mb-12">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="text-3xl mb-3">📦</div>
            <h3 className="font-bold mb-2">상품 관리</h3>
            <p className="text-sm text-gray-500">간편한 상품 등록 및 재고 관리</p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="text-3xl mb-3">📺</div>
            <h3 className="font-bold mb-2">라이브 커머스</h3>
            <p className="text-sm text-gray-500">실시간 라이브 방송으로 판매</p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="text-3xl mb-3">💰</div>
            <h3 className="font-bold mb-2">정산 관리</h3>
            <p className="text-sm text-gray-500">투명한 매출 및 정산 관리</p>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          {user ? (
            <Link href="/partner/register" className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700">파트너 입점 신청</Link>
          ) : (
            <>
              <Link href="/partner/login" className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700">파트너 로그인</Link>
              <Link href="/partner/register" className="border border-blue-600 text-blue-600 px-8 py-3 rounded-lg font-medium hover:bg-blue-50">입점 신청</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
