'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import Link from 'next/link';

interface Order {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  createdAt: string;
  user: {
    name: string;
    email: string;
    phone: string;
  };
  partner?: {
    storeName: string;
  };
  items: Array<{
    product: {
      name: string;
      thumbnail: string;
      price: number;
    };
    quantity: number;
    price: number;
  }>;
}

export default function AdminOrders() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/partner/login');
      return;
    }

    if (user?.role === 'ADMIN') {
      fetchOrders();
    }
  }, [user, authLoading, router, statusFilter, page]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/orders?status=${statusFilter}&page=${page}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setOrders(result.data.orders);
        setTotalPages(result.data.pagination.totalPages);
      } else {
        setError(result.error || '주문을 불러올 수 없습니다');
      }
    } catch (err) {
      console.error('주문 조회 실패:', err);
      setError('주문을 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    if (!confirm(`주문 상태를 "${getStatusText(newStatus)}"(으)로 변경하시겠습니까?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const result = await response.json();
      if (result.success) {
        alert('주문 상태가 변경되었습니다');
        fetchOrders();
      } else {
        alert(result.error || '상태 변경에 실패했습니다');
      }
    } catch (err) {
      console.error('상태 변경 실패:', err);
      alert('상태 변경 중 오류가 발생했습니다');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(price);
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'PENDING': '결제 대기',
      'CONFIRMED': '주문 확인',
      'SHIPPING': '배송 중',
      'DELIVERED': '배송 완료',
      'CANCELLED': '취소됨',
      'REFUNDED': '환불됨'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'CONFIRMED': 'bg-blue-100 text-blue-800',
      'SHIPPING': 'bg-purple-100 text-purple-800',
      'DELIVERED': 'bg-green-100 text-green-800',
      'CANCELLED': 'bg-red-100 text-red-800',
      'REFUNDED': 'bg-gray-100 text-gray-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">주문 관리</h1>
          <p className="mt-2 text-gray-600">전체 주문 조회 및 상태 관리</p>
        </div>

        {/* 네비게이션 */}
        <div className="mb-8 flex flex-wrap gap-4">
          <Link href="/admin" className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            대시보드
          </Link>
          <Link href="/admin/orders" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            주문 관리
          </Link>
          <Link href="/admin/partners" className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            파트너 관리
          </Link>
          <Link href="/admin/products" className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            상품 관리
          </Link>
        </div>

        {/* 필터 */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-2">
            {['ALL', 'PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'REFUNDED'].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'ALL' ? '전체' : getStatusText(status)}
              </button>
            ))}
          </div>
        </div>

        {/* 주문 목록 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {error ? (
            <div className="p-8 text-center text-red-600">{error}</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">주문이 없습니다</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문번호</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">고객</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">금액</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문일시</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {order.orderNumber}
                          {order.partner && (
                            <div className="text-xs text-gray-500 mt-1">{order.partner.storeName}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div>{order.user.name}</div>
                          <div className="text-xs text-gray-400">{order.user.email}</div>
                          <div className="text-xs text-gray-400">{order.user.phone}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <img 
                              src={order.items[0]?.product.thumbnail || '/placeholder.jpg'} 
                              alt="" 
                              className="w-10 h-10 object-cover rounded"
                            />
                            <div>
                              <div>{order.items[0]?.product.name}</div>
                              {order.items.length > 1 && (
                                <div className="text-xs text-gray-400">외 {order.items.length - 1}건</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {formatPrice(order.total)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                            {getStatusText(order.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(order.createdAt).toLocaleString('ko-KR')}
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={order.status}
                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="PENDING">결제 대기</option>
                            <option value="CONFIRMED">주문 확인</option>
                            <option value="SHIPPING">배송 중</option>
                            <option value="DELIVERED">배송 완료</option>
                            <option value="CANCELLED">취소됨</option>
                            <option value="REFUNDED">환불됨</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    이전
                  </button>
                  <span className="px-4 py-1 text-sm text-gray-600">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    다음
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
