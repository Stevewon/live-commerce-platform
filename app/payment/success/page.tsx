'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(true);
  const [orderInfo, setOrderInfo] = useState<any>(null);

  const orderId = searchParams.get('orderId');
  const paymentKey = searchParams.get('paymentKey');
  const amount = searchParams.get('amount');

  useEffect(() => {
    if (!orderId || !paymentKey || !amount) {
      alert('잘못된 접근입니다');
      router.push('/');
      return;
    }

    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('로그인이 필요합니다');
        router.push('/partner/login');
        return;
      }

      // 결제 검증 API 호출
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ orderId, paymentKey, amount: parseInt(amount || '0') })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '결제 검증에 실패했습니다');
      }

      setOrderInfo({
        orderNumber: data.order.orderNumber,
        amount: data.order.total,
        paymentKey: data.payment.paymentKey,
        method: data.payment.method,
        approvedAt: data.payment.approvedAt
      });
      
      setIsVerifying(false);

      // 장바구니 비우기
      await fetch('/api/cart', {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error: any) {
      console.error('Payment verification error:', error);
      alert(error.message || '결제 검증에 실패했습니다');
      router.push('/cart');
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400 text-xl">결제를 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        {/* 성공 아이콘 */}
        <div className="text-center mb-8">
          <div className="inline-block p-6 bg-green-500/20 rounded-full mb-4">
            <svg className="w-24 h-24 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold mb-2">결제 완료!</h1>
          <p className="text-gray-400 text-lg">주문이 성공적으로 처리되었습니다</p>
        </div>

        {/* 주문 정보 */}
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-8 mb-6">
          <div className="space-y-4">
            <div className="flex justify-between border-b border-gray-700 pb-4">
              <span className="text-gray-400">주문번호</span>
              <span className="font-bold">{orderInfo?.orderNumber}</span>
            </div>
            <div className="flex justify-between border-b border-gray-700 pb-4">
              <span className="text-gray-400">결제 키</span>
              <span className="font-mono text-sm text-gray-300">{orderInfo?.paymentKey?.slice(0, 20)}...</span>
            </div>
            <div className="flex justify-between pt-4">
              <span className="text-gray-400 text-lg">결제 금액</span>
              <span className="text-2xl font-bold text-blue-400">
                ₩{orderInfo?.amount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 안내 메시지 */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 mb-8">
          <h3 className="text-blue-400 font-semibold mb-2">📦 다음 단계</h3>
          <ul className="space-y-2 text-gray-300 text-sm">
            <li>• 주문 내역은 마이페이지에서 확인하실 수 있습니다</li>
            <li>• 상품은 영업일 기준 2-3일 내에 배송됩니다</li>
            <li>• 배송 조회는 마이페이지 {'>'} 주문 내역에서 가능합니다</li>
          </ul>
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/my/orders"
            className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-bold text-center transition-all transform hover:scale-105 shadow-lg"
          >
            주문 내역 보기
          </Link>
          <Link
            href="/shop"
            className="flex-1 py-4 bg-gray-700/50 hover:bg-gray-700 text-white rounded-xl font-bold text-center transition-all border border-gray-600"
          >
            쇼핑 계속하기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400 text-xl">로딩 중...</p>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
