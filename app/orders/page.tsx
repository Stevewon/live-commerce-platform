'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';

interface Order {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  createdAt: string;
  items: Array<{
    product: {
      name: string;
      thumbnail: string;
    };
    quantity: number;
    price: number;
  }>;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '결제 대기', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: '결제 완료', color: 'bg-blue-100 text-blue-800' },
  SHIPPING: { label: '배송 중', color: 'bg-purple-100 text-purple-800' },
  DELIVERED: { label: '배송 완료', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: '취소됨', color: 'bg-red-100 text-red-800' },
};

export default function OrdersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.data || []);
      }
    } catch (error) {
      console.error('주문 내역 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">📦 주문 내역</h1>
          <p className="mt-2 text-gray-600">주문하신 상품의 배송 상태를 확인하세요</p>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">주문 내역이 없습니다</h2>
            <p className="text-gray-600 mb-6">첫 주문을 시작해보세요!</p>
            <Link
              href="/products"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              쇼핑하러 가기
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                      <p className="font-semibold text-gray-900">{order.orderNumber}</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        STATUS_MAP[order.status]?.color || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {STATUS_MAP[order.status]?.label || order.status}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex gap-4">
                        <img
                          src={item.product.thumbnail}
                          alt={item.product.name}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{item.product.name}</h3>
                          <p className="text-sm text-gray-600">
                            ₩{item.price.toLocaleString()} × {item.quantity}개
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">
                            ₩{(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t flex justify-between items-center">
                    <div>
                      <span className="text-gray-600">총 결제 금액:</span>
                      <span className="ml-2 text-xl font-bold text-blue-600">
                        ₩{order.total.toLocaleString()}
                      </span>
                    </div>
                    <Link
                      href={`/orders/${order.id}`}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                    >
                      상세보기
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
