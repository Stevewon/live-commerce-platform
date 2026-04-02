'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ShopNavigation from '@/components/ShopNavigation';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  product: {
    id: string;
    name: string;
    thumbnail: string;
    slug: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientAddressDetail: string;
  recipientPostcode: string;
  message?: string;
  paymentMethod?: string;
  createdAt: string;
  items: OrderItem[];
}

const statusMap: Record<string, { label: string; color: string }> = {
  PENDING: { label: '결제대기', color: 'bg-yellow-100 text-yellow-800' },
  PAID: { label: '결제완료', color: 'bg-green-100 text-green-800' },
  CONFIRMED: { label: '주문확인', color: 'bg-blue-100 text-blue-800' },
  PREPARING: { label: '상품준비중', color: 'bg-indigo-100 text-indigo-800' },
  SHIPPING: { label: '배송중', color: 'bg-purple-100 text-purple-800' },
  DELIVERED: { label: '배송완료', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: '취소됨', color: 'bg-red-100 text-red-800' },
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrder();
  }, [params.id]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/orders/${params.id}`, {
        credentials: 'include',
      });
      
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      
      if (!response.ok) {
        throw new Error('주문을 불러오는데 실패했습니다.');
      }
      
      const data = await response.json();
      setOrder(data.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">주문 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || '주문을 찾을 수 없습니다.'}</p>
          <Link
            href="/my-orders"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            주문 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const status = statusMap[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-800' };

  return (
    <div className="min-h-screen bg-gray-50">
      <ShopNavigation />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/my-orders"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← 주문 목록
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">주문 상세</h1>
        </div>

        {/* Order Info Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-500">주문번호</p>
              <p className="text-lg font-semibold">{order.orderNumber}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            주문일시: {new Date(order.createdAt).toLocaleString('ko-KR')}
          </p>
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">주문 상품</h2>
          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-4 pb-4 border-b last:border-b-0">
                <img
                  src={item.product.thumbnail || 'https://via.placeholder.com/100'}
                  alt={item.product.name}
                  className="w-20 h-20 object-cover rounded"
                />
                <div className="flex-1">
                  <Link
                    href={`/products/${item.product.slug}`}
                    className="font-medium text-gray-900 hover:text-blue-600"
                  >
                    {item.product.name}
                  </Link>
                  <p className="text-sm text-gray-500 mt-1">
                    수량: {item.quantity}개
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    ₩{(item.price * item.quantity).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">배송 정보</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">받는 사람</dt>
              <dd className="text-gray-900">{order.recipientName}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">연락처</dt>
              <dd className="text-gray-900">{order.recipientPhone}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">주소</dt>
              <dd className="text-gray-900">
                ({order.recipientPostcode}) {order.recipientAddress} {order.recipientAddressDetail}
              </dd>
            </div>
            {order.message && (
              <div>
                <dt className="text-sm text-gray-500">배송 메시지</dt>
                <dd className="text-gray-900">{order.message}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Payment Info */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">결제 정보</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">상품금액</span>
              <span className="text-gray-900">₩{order.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">배송비</span>
              <span className="text-gray-900">₩{order.shippingFee.toLocaleString()}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-semibold text-lg">
              <span>총 결제금액</span>
              <span className="text-blue-600">₩{order.total.toLocaleString()}</span>
            </div>
            {order.paymentMethod && (
              <div className="flex justify-between text-sm text-gray-500 pt-2">
                <span>결제수단</span>
                <span>{order.paymentMethod === 'card' ? '신용카드' : order.paymentMethod}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4">
          <Link
            href="/my-orders"
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-6 rounded-lg text-center transition"
          >
            주문 목록
          </Link>
          <Link
            href="/products"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg text-center transition"
          >
            계속 쇼핑하기
          </Link>
        </div>
      </div>
    </div>
  );
}
