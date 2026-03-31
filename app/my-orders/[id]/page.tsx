'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import ShopNavigation from '@/components/ShopNavigation';
import { ORDER_STATUS_MAP, COURIER_COMPANIES, getTrackingUrl } from '@/lib/utils/courier';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  optionValues: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
    thumbnail: string;
    price: number;
    images: string;
    category?: { name: string };
  };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingZipCode: string | null;
  shippingMemo: string | null;
  trackingCompany: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  refundAmount: number | null;
  refundedAt: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  createdAt: string;
  items: OrderItem[];
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login?redirect=/my-orders');
      return;
    }
    fetchOrder();
  }, [user, authLoading, orderId]);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
      } else {
        setError('주문을 찾을 수 없습니다.');
      }
    } catch {
      setError('주문 정보를 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('주문을 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      if (res.ok) {
        fetchOrder();
      } else {
        const data = await res.json();
        alert(data.error || '주문 취소에 실패했습니다.');
      }
    } catch {
      alert('주문 취소 중 오류가 발생했습니다.');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ShopNavigation />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">주문 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ShopNavigation />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <span className="text-6xl block mb-4">😢</span>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{error || '주문을 찾을 수 없습니다'}</h1>
          <Link href="/my-orders" className="text-blue-600 hover:underline">주문 목록으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  const statusInfo = ORDER_STATUS_MAP[order.status] || ORDER_STATUS_MAP.PENDING;
  const canCancel = order.status === 'PENDING' || order.status === 'CONFIRMED';
  const trackingUrl = order.trackingCompany && order.trackingNumber
    ? getTrackingUrl(order.trackingCompany, order.trackingNumber)
    : null;

  // Order timeline
  const timeline = [
    { label: '주문접수', date: order.createdAt, done: true },
    { label: '결제완료', date: order.paidAt, done: !!order.paidAt },
    { label: '배송시작', date: order.shippedAt, done: !!order.shippedAt },
    { label: '배송완료', date: order.deliveredAt, done: !!order.deliveredAt },
  ];

  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
    timeline.push({ label: order.status === 'CANCELLED' ? '주문취소' : '환불완료', date: order.cancelledAt || order.refundedAt, done: true });
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      <ShopNavigation />
      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/my-orders" className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">주문 상세</h1>
            <p className="text-sm text-gray-500">주문번호: {order.orderNumber}</p>
          </div>
        </div>

        {/* Status + Timeline */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4">
          <div className="flex items-center justify-between mb-6">
            <span className={`px-4 py-2 rounded-full text-sm font-bold ${statusInfo.color} ${statusInfo.bgColor}`}>
              {statusInfo.label}
            </span>
            <span className="text-sm text-gray-500">
              {new Date(order.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Timeline */}
          <div className="flex items-center justify-between relative">
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200" />
            {timeline.map((step, i) => (
              <div key={i} className="relative flex flex-col items-center z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step.done ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {step.done ? '✓' : i + 1}
                </div>
                <span className={`mt-2 text-xs font-medium ${step.done ? 'text-blue-600' : 'text-gray-400'}`}>
                  {step.label}
                </span>
                {step.date && (
                  <span className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(step.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tracking info */}
        {order.trackingCompany && order.trackingNumber && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 sm:p-6 mb-4">
            <h3 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
              <span>🚚</span> 배송 추적 정보
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-indigo-500 mb-1">택배사</p>
                <p className="text-sm font-medium text-indigo-900">{order.trackingCompany}</p>
              </div>
              <div>
                <p className="text-xs text-indigo-500 mb-1">운송장 번호</p>
                <p className="text-sm font-mono font-medium text-indigo-900">{order.trackingNumber}</p>
              </div>
            </div>
            {trackingUrl && (
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
              >
                🔍 실시간 배송조회
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        )}

        {/* Order items */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>📦</span> 주문 상품 ({order.items.length}개)
          </h3>
          <div className="space-y-4">
            {order.items.map(item => {
              let optionLabel = '';
              if (item.optionValues) {
                try {
                  const opts = JSON.parse(item.optionValues);
                  optionLabel = Object.entries(opts).map(([k, v]) => `${k}: ${v}`).join(', ');
                } catch {}
              }
              return (
                <div key={item.id} className="flex gap-4 py-2">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <img
                      src={item.product.thumbnail}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                      onError={e => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-3xl">📦</div>';
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/products/${item.product.slug}`} className="font-medium text-gray-900 hover:text-blue-600 line-clamp-2">
                      {item.product.name}
                    </Link>
                    {optionLabel && (
                      <p className="text-xs text-gray-500 mt-1">{optionLabel}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                      ₩{item.price.toLocaleString()} x {item.quantity}개
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900">₩{(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment summary */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>💳</span> 결제 정보
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">상품 금액</span>
              <span className="text-gray-900">₩{order.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">배송비</span>
              <span className="text-gray-900">{order.shippingFee === 0 ? '무료' : `₩${order.shippingFee.toLocaleString()}`}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">할인</span>
                <span className="text-green-600">-₩{order.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-3 mt-3">
              <span className="text-gray-900">총 결제금액</span>
              <span className="text-blue-600">₩{order.total.toLocaleString()}</span>
            </div>
            {order.paymentMethod && (
              <p className="text-xs text-gray-400 text-right mt-1">
                결제수단: {order.paymentMethod === 'card' ? '신용카드' : order.paymentMethod}
                {order.paidAt && ` | ${new Date(order.paidAt).toLocaleDateString('ko-KR')}`}
              </p>
            )}
            {order.refundAmount && (
              <div className="flex justify-between text-sm text-red-600 pt-2 border-t mt-2">
                <span>환불금액</span>
                <span className="font-bold">₩{order.refundAmount.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Shipping info */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>🏠</span> 배송지 정보
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex gap-4">
              <span className="text-gray-500 w-20 flex-shrink-0">받는 분</span>
              <span className="text-gray-900">{order.shippingName}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-gray-500 w-20 flex-shrink-0">연락처</span>
              <span className="text-gray-900">{order.shippingPhone}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-gray-500 w-20 flex-shrink-0">주소</span>
              <span className="text-gray-900">
                {order.shippingZipCode && `(${order.shippingZipCode}) `}
                {order.shippingAddress}
              </span>
            </div>
            {order.shippingMemo && (
              <div className="flex gap-4">
                <span className="text-gray-500 w-20 flex-shrink-0">배송메모</span>
                <span className="text-gray-900">{order.shippingMemo}</span>
              </div>
            )}
          </div>
        </div>

        {/* Cancel reason */}
        {order.cancelReason && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6 mb-4">
            <h3 className="font-bold text-red-900 mb-2">취소 사유</h3>
            <p className="text-sm text-red-700">{order.cancelReason}</p>
            {order.cancelledAt && (
              <p className="text-xs text-red-500 mt-1">
                취소일시: {new Date(order.cancelledAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Link
            href="/my-orders"
            className="flex-1 py-3 text-center text-gray-700 bg-white border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition"
          >
            목록으로
          </Link>
          {canCancel && (
            <button
              onClick={handleCancel}
              className="flex-1 py-3 text-center text-red-600 bg-white border border-red-200 rounded-xl font-medium hover:bg-red-50 transition"
            >
              주문 취소
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
