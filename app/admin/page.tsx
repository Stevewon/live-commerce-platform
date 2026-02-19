'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import Link from 'next/link';

interface Stats {
  overview: {
    totalOrders: number;
    totalUsers: number;
    totalPartners: number;
    totalProducts: number;
    totalRevenue: number;
    activePartners: number;
    pendingSettlements: number;
  };
  orderStatus: {
    pending: number;
    shipping: number;
    completed: number;
  };
  today: {
    orders: number;
    revenue: number;
    users: number;
  };
  recentOrders: any[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/partner/login');
      return;
    }

    if (user?.role === 'ADMIN') {
      fetchStats();
    }
  }, [user, authLoading, router]);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      } else {
        setError(result.error || '통계를 불러올 수 없습니다');
      }
    } catch (err) {
      console.error('통계 조회 실패:', err);
      setError('통계를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>
          <p className="mt-2 text-gray-600">플랫폼 전체 통계 및 관리</p>
        </div>

        {/* 네비게이션 */}
        <div className="mb-8 flex flex-wrap gap-4">
          <Link href="/admin" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            대시보드
          </Link>
          <Link href="/admin/orders" className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            주문 관리
          </Link>
          <Link href="/admin/partners" className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            파트너 관리
          </Link>
          <Link href="/admin/products" className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            상품 관리
          </Link>
        </div>

        {/* 오늘의 통계 */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">오늘의 통계</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">오늘 주문</p>
                  <p className="text-3xl font-bold mt-2">{stats.today.orders}</p>
                </div>
                <div className="text-5xl opacity-20">📦</div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">오늘 매출</p>
                  <p className="text-2xl font-bold mt-2">{formatPrice(stats.today.revenue)}</p>
                </div>
                <div className="text-5xl opacity-20">💰</div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">신규 가입</p>
                  <p className="text-3xl font-bold mt-2">{stats.today.users}</p>
                </div>
                <div className="text-5xl opacity-20">👥</div>
              </div>
            </div>
          </div>
        </div>

        {/* 전체 통계 */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">전체 통계</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">전체 주문</p>
                  <p className="text-2xl font-bold mt-2">{stats.overview.totalOrders}</p>
                </div>
                <div className="text-4xl">📦</div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">전체 매출</p>
                  <p className="text-xl font-bold mt-2">{formatPrice(stats.overview.totalRevenue)}</p>
                </div>
                <div className="text-4xl">💰</div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">총 사용자</p>
                  <p className="text-2xl font-bold mt-2">{stats.overview.totalUsers}</p>
                </div>
                <div className="text-4xl">👤</div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">총 파트너</p>
                  <p className="text-2xl font-bold mt-2">{stats.overview.totalPartners}</p>
                  <p className="text-xs text-gray-500 mt-1">활성: {stats.overview.activePartners}</p>
                </div>
                <div className="text-4xl">🤝</div>
              </div>
            </div>
          </div>
        </div>

        {/* 주문 상태 */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">주문 상태</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">대기 중</p>
                  <p className="text-2xl font-bold mt-2 text-yellow-600">{stats.orderStatus.pending}</p>
                </div>
                <div className="text-4xl">⏳</div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">배송 중</p>
                  <p className="text-2xl font-bold mt-2 text-purple-600">{stats.orderStatus.shipping}</p>
                </div>
                <div className="text-4xl">🚚</div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">배송 완료</p>
                  <p className="text-2xl font-bold mt-2 text-green-600">{stats.orderStatus.completed}</p>
                </div>
                <div className="text-4xl">✅</div>
              </div>
            </div>
          </div>
        </div>

        {/* 최근 주문 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">최근 주문</h2>
              <Link href="/admin/orders" className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                전체 보기 →
              </Link>
            </div>
          </div>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.orderNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {order.user.name}<br />
                      <span className="text-xs text-gray-400">{order.user.email}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {order.items[0]?.product.name}
                      {order.items.length > 1 && ` 외 ${order.items.length - 1}건`}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatPrice(order.total)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(order.createdAt).toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 추가 정보 */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">플랫폼 정보</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">총 상품</span>
                <span className="font-medium">{stats.overview.totalProducts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">활성 파트너</span>
                <span className="font-medium">{stats.overview.activePartners}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">대기 정산</span>
                <span className="font-medium text-yellow-600">{stats.overview.pendingSettlements}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">빠른 링크</h3>
            <div className="space-y-2">
              <Link href="/admin/orders?status=PENDING" className="block text-purple-600 hover:text-purple-700">
                → 대기 중인 주문 확인
              </Link>
              <Link href="/admin/partners?status=inactive" className="block text-purple-600 hover:text-purple-700">
                → 비활성 파트너 관리
              </Link>
              <Link href="/admin/products?status=inactive" className="block text-purple-600 hover:text-purple-700">
                → 비활성 상품 관리
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
