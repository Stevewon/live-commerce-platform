'use client';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'
;

interface Order {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
  partner: {
    storeName: string;
  } | null;
  items: {
    id: string;
    quantity: number;
    price: number;
    product: {
      name: string;
      price: number;
    };
  }[];
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_LABELS: Record<string, string> = {
  ALL: '전체',
  PENDING: '대기중',
  CONFIRMED: '확인됨',
  SHIPPING: '배송중',
  DELIVERED: '배송완료',
  CANCELLED: '취소됨',
  REFUNDED: '환불됨',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white',
  CONFIRMED: 'bg-gradient-to-r from-blue-400 to-blue-500 text-white',
  SHIPPING: 'bg-gradient-to-r from-purple-400 to-purple-500 text-white',
  DELIVERED: 'bg-gradient-to-r from-emerald-400 to-emerald-500 text-white',
  CANCELLED: 'bg-gradient-to-r from-red-400 to-red-500 text-white',
  REFUNDED: 'bg-gradient-to-r from-gray-400 to-gray-500 text-white',
};

const STATUS_ICONS: Record<string, string> = {
  PENDING: '⏳',
  CONFIRMED: '✅',
  SHIPPING: '🚚',
  DELIVERED: '📦',
  CANCELLED: '❌',
  REFUNDED: '💸',
};

export default function AdminOrdersPage() {
  const { user, loading: authLoading } = useAdminAuth()
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingCompany, setTrackingCompany] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      loadOrders();
    }
  }, [user, statusFilter, pagination.page, searchQuery]);

  const loadOrders = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        status: statusFilter,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const res = await fetch(`/api/admin/orders?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('주문 목록 로드 실패');

      const data = await res.json();
      setOrders(data.orders || []);
      if (data.pagination) setPagination(data.pagination);
    } catch (error) {
      console.error('Load orders error:', error);
      alert('주문 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string, tracking?: { company: string; number: string }) => {
    if (!confirm(`주문 상태를 "${STATUS_LABELS[newStatus]}"(으)로 변경하시겠습니까?`)) {
      return;
    }

    try {
      const body: any = { status: newStatus };
      if (tracking?.company) body.trackingCompany = tracking.company;
      if (tracking?.number) body.trackingNumber = tracking.number;

      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('상태 변경 실패');

      alert('주문 상태가 변경되었습니다');
      loadOrders();
    } catch (error) {
      console.error('Status change error:', error);
      alert('상태 변경에 실패했습니다');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination({ ...pagination, page: 1 });
    loadOrders();
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);

      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/admin/orders/export?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('다운로드 실패');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Content-Disposition 헤더에서 파일명 추출
      const disposition = res.headers.get('Content-Disposition');
      let fileName = `orders_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) fileName = match[1];
      }

      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert('주문 목록 다운로드에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    return (
      <span className={`px-4 py-2 rounded-xl text-sm font-black shadow-md flex items-center space-x-1 ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'}`}>
        <span>{STATUS_ICONS[status] || '📋'}</span>
        <span>{STATUS_LABELS[status] || status}</span>
      </span>
    );
  };

  if (authLoading || (loading && orders.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-purple-200 border-t-purple-600 mx-auto mb-6"></div>
          <p className="text-gray-600 font-bold text-lg">주문 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Premium Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 shadow-2xl border-b-4 border-blue-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl">
                <span className="text-3xl">📦</span>
              </div>
              <div>
                <h1 className="text-4xl font-black text-white drop-shadow-lg">
                  주문 관리 시스템
                </h1>
                <p className="mt-2 text-blue-200 text-lg font-medium">Enterprise Order Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl px-6 py-3 border border-white/20">
                <div className="text-sm text-blue-200 font-medium">관리자</div>
                <div className="text-lg font-bold text-white">{user?.name}</div>
              </div>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-black text-2xl shadow-2xl ring-4 ring-white/20 hover:scale-110 transition-transform cursor-pointer">
                {user?.name?.charAt(0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Premium Navigation */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-2xl p-3 inline-flex space-x-2 border border-gray-200">
            <Link href="/admin" className="group px-8 py-4 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-bold flex items-center space-x-2 hover:scale-105 duration-200">
              <span className="text-2xl group-hover:scale-110 transition-transform">📊</span>
              <span>대시보드</span>
            </Link>
            <Link href="/admin/users" className="group px-8 py-4 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-bold flex items-center space-x-2 hover:scale-105 duration-200">
              <span className="text-2xl group-hover:scale-110 transition-transform">👥</span>
              <span>회원 관리</span>
            </Link>
            <Link href="/admin/orders" className="group px-8 py-4 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-700 text-white rounded-xl shadow-xl font-bold flex items-center space-x-2 ring-4 ring-blue-200 scale-105">
              <span className="text-2xl">📦</span>
              <span>주문 관리</span>
            </Link>
            <Link href="/admin/partners" className="group px-8 py-4 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-bold flex items-center space-x-2 hover:scale-105 duration-200">
              <span className="text-2xl group-hover:scale-110 transition-transform">🤝</span>
              <span>파트너 관리</span>
            </Link>
            <Link href="/admin/products" className="group px-8 py-4 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-bold flex items-center space-x-2 hover:scale-105 duration-200">
              <span className="text-2xl group-hover:scale-110 transition-transform">🛍️</span>
              <span>상품 관리</span>
            </Link>
            <Link href="/admin/reports" className="group px-8 py-4 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-bold flex items-center space-x-2 hover:scale-105 duration-200">
              <span className="text-2xl group-hover:scale-110 transition-transform">📈</span>
              <span>매출 리포트</span>
            </Link>
          </div>
        </div>

        {/* Premium Statistics */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="group bg-gradient-to-br from-white to-purple-50 rounded-3xl shadow-2xl p-6 border-t-4 border-purple-500 hover:shadow-purple-200 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="text-xs font-black text-purple-600 uppercase tracking-wider mb-2">📊 전체 주문</div>
            <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 group-hover:scale-110 transition-transform">
              {pagination.total}
            </div>
            <div className="text-xs text-gray-500 mt-2 font-semibold">Total Orders</div>
          </div>

          <div className="group bg-gradient-to-br from-white to-yellow-50 rounded-3xl shadow-2xl p-6 border-t-4 border-yellow-500 hover:shadow-yellow-200 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="text-xs font-black text-yellow-600 uppercase tracking-wider mb-2">⏳ 대기중</div>
            <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-orange-600 group-hover:scale-110 transition-transform">
              {orders.filter(o => o.status === 'PENDING').length}
            </div>
            <div className="text-xs text-gray-500 mt-2 font-semibold">Pending</div>
          </div>

          <div className="group bg-gradient-to-br from-white to-blue-50 rounded-3xl shadow-2xl p-6 border-t-4 border-blue-500 hover:shadow-blue-200 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="text-xs font-black text-blue-600 uppercase tracking-wider mb-2">🚚 배송중</div>
            <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600 group-hover:scale-110 transition-transform">
              {orders.filter(o => o.status === 'SHIPPING').length}
            </div>
            <div className="text-xs text-gray-500 mt-2 font-semibold">Shipping</div>
          </div>

          <div className="group bg-gradient-to-br from-white to-emerald-50 rounded-3xl shadow-2xl p-6 border-t-4 border-emerald-500 hover:shadow-emerald-200 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-2">✅ 완료</div>
            <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-green-600 group-hover:scale-110 transition-transform">
              {orders.filter(o => o.status === 'DELIVERED').length}
            </div>
            <div className="text-xs text-gray-500 mt-2 font-semibold">Delivered</div>
          </div>
        </div>

        {/* Premium Filters */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl p-8 mb-8 border border-gray-200">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap gap-3 mb-6">
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setPagination({ ...pagination, page: 1 });
                }}
                className={`px-8 py-4 rounded-2xl font-black transition-all duration-300 shadow-lg flex items-center space-x-2 ${
                  statusFilter === status
                    ? 'bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-700 text-white shadow-blue-300 scale-110 ring-4 ring-blue-200'
                    : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 hover:from-blue-50 hover:to-blue-100 hover:scale-105'
                }`}
              >
                <span className="text-xl">{STATUS_ICONS[status] || '📋'}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1 relative group">
              <input
                type="text"
                placeholder="주문번호, 고객명, 이메일로 검색하세요..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-14 pr-6 py-5 border-3 border-gray-300 rounded-2xl focus:ring-4 focus:ring-blue-300 focus:border-blue-500 transition-all text-lg font-medium shadow-inner bg-white group-hover:border-blue-400 placeholder:text-gray-400"
              />
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-500 text-2xl group-hover:scale-125 transition-transform">
                🔍
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    loadOrders();
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              )}
            </div>
            <button type="submit" className="px-8 py-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl hover:from-blue-600 hover:to-blue-700 font-black shadow-lg hover:scale-110 transition-all">
              검색
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting}
              className="px-8 py-5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl hover:from-emerald-600 hover:to-emerald-700 font-black shadow-lg hover:scale-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {exporting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>다운로드 중...</span>
                </>
              ) : (
                <>
                  <span className="text-xl">📥</span>
                  <span>엑셀 다운로드</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Premium Orders Table */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
          <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-blue-50 border-b-2 border-gray-200">
            <h2 className="text-2xl font-black text-gray-900 flex items-center">
              <span className="text-3xl mr-3">📋</span>
              주문 목록 ({pagination.total}건)
            </h2>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-8xl mb-6">📭</div>
              <p className="text-gray-500 font-bold text-xl">주문이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-800 via-blue-900 to-indigo-900 border-b-4 border-blue-500">
                    <th className="px-8 py-6 text-left text-sm font-black text-white uppercase tracking-wider">
                      🔢 주문번호
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-black text-white uppercase tracking-wider">
                      👤 고객
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-black text-white uppercase tracking-wider">
                      🏪 파트너
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-black text-white uppercase tracking-wider">
                      💰 주문금액
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-black text-white uppercase tracking-wider">
                      📊 상태
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-black text-white uppercase tracking-wider">
                      🕐 주문일시
                    </th>
                    <th className="px-8 py-6 text-left text-sm font-black text-white uppercase tracking-wider">
                      ⚙️ 관리
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 group">
                      <td className="px-8 py-6">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="font-mono text-lg font-black text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {order.orderNumber}
                        </button>
                      </td>
                      <td className="px-8 py-6">
                        <div>
                          <div className="text-base font-black text-gray-900">
                            {order.user?.name || '미설정'}
                          </div>
                          <div className="text-sm text-gray-600 font-medium mt-1">
                            📧 {order.user?.email || '-'}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-bold text-gray-700">
                          {order.partner?.storeName || '-'}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
                          {formatCurrency(order.total)}
                        </div>
                      </td>
                      <td className="px-8 py-6">{getStatusBadge(order.status)}</td>
                      <td className="px-8 py-6">
                        <div className="text-sm text-gray-700 font-bold">
                          {formatDate(order.createdAt)}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className="px-4 py-3 border-3 border-gray-300 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-300 focus:border-blue-500 hover:border-blue-400 transition-all cursor-pointer bg-white shadow-sm"
                        >
                          <option value="PENDING">⏳ 대기중</option>
                          <option value="CONFIRMED">✅ 확인됨</option>
                          <option value="SHIPPING">🚚 배송중</option>
                          <option value="DELIVERED">📦 배송완료</option>
                          <option value="CANCELLED">❌ 취소됨</option>
                          <option value="REFUNDED">💸 환불됨</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Premium Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-blue-50 border-t-2 border-gray-200 flex items-center justify-between">
              <div className="text-base text-gray-700 font-bold">
                전체 {pagination.total}개 중 {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} 표시
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() =>
                    setPagination({ ...pagination, page: pagination.page - 1 })
                  }
                  disabled={pagination.page === 1}
                  className="px-6 py-3 text-base font-black text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                >
                  ⬅️ 이전
                </button>
                <span className="px-6 py-3 text-base font-black text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() =>
                    setPagination({ ...pagination, page: pagination.page + 1 })
                  }
                  disabled={pagination.page === pagination.totalPages}
                  className="px-6 py-3 text-base font-black text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                >
                  다음 ➡️
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Premium Order Detail Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border-4 border-blue-500 animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-blue-700 flex justify-between items-center">
              <h3 className="text-2xl font-black text-white flex items-center">
                <span className="text-3xl mr-3">📋</span>
                주문 상세 정보
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-10 h-10 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-xl text-white text-2xl font-bold transition-all hover:scale-110"
              >
                ✕
              </button>
            </div>
            
            <div className="px-8 py-6 space-y-6">
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-200">
                <h4 className="font-black text-gray-900 mb-4 text-lg flex items-center">
                  <span className="text-2xl mr-2">📝</span>
                  주문 정보
                </h4>
                <div className="space-y-3 text-base">
                  <div className="flex justify-between items-center bg-white rounded-xl p-4">
                    <span className="text-gray-600 font-bold">주문번호:</span>
                    <span className="font-mono font-black text-blue-700">
                      {selectedOrder.orderNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-white rounded-xl p-4">
                    <span className="text-gray-600 font-bold">상태:</span>
                    {getStatusBadge(selectedOrder.status)}
                  </div>
                  <div className="flex justify-between items-center bg-white rounded-xl p-4">
                    <span className="text-gray-600 font-bold">주문일시:</span>
                    <span className="font-bold text-gray-900">{formatDate(selectedOrder.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200">
                <h4 className="font-black text-gray-900 mb-4 text-lg flex items-center">
                  <span className="text-2xl mr-2">👤</span>
                  고객 정보
                </h4>
                <div className="space-y-3 text-base">
                  <div className="flex justify-between items-center bg-white rounded-xl p-4">
                    <span className="text-gray-600 font-bold">이름:</span>
                    <span className="font-black text-gray-900">{selectedOrder.user?.name || '미설정'}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white rounded-xl p-4">
                    <span className="text-gray-600 font-bold">이메일:</span>
                    <span className="font-bold text-gray-700">{selectedOrder.user?.email || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200">
                <h4 className="font-black text-gray-900 mb-4 text-lg flex items-center">
                  <span className="text-2xl mr-2">🛍️</span>
                  주문 상품
                </h4>
                <div className="space-y-3">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl p-5 flex justify-between items-center border-2 border-purple-100 hover:border-purple-300 transition-all"
                    >
                      <div>
                        <div className="font-black text-gray-900 text-lg">{item.product.name}</div>
                        <div className="text-sm text-gray-600 font-bold mt-1">
                          {formatCurrency(item.price)} × {item.quantity}개
                        </div>
                      </div>
                      <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                        {formatCurrency(item.price * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-black text-white">💰 총 주문금액</span>
                  <span className="text-4xl font-black text-white">
                    {formatCurrency(selectedOrder.total)}
                  </span>
                </div>
              </div>

              {/* 배송 추적 정보 입력 */}
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-6 border-2 border-indigo-200">
                <h4 className="font-black text-gray-900 mb-4 text-lg flex items-center">
                  <span className="text-2xl mr-2">🚚</span>
                  배송 추적 정보
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">택배사</label>
                    <select
                      value={trackingCompany}
                      onChange={(e) => setTrackingCompany(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-200 focus:border-indigo-500"
                    >
                      <option value="">택배사 선택</option>
                      <option value="CJ대한통운">CJ대한통운</option>
                      <option value="롯데택배">롯데택배</option>
                      <option value="한진택배">한진택배</option>
                      <option value="로젠택배">로젠택배</option>
                      <option value="우체국택배">우체국택배</option>
                      <option value="경동택배">경동택배</option>
                      <option value="대신택배">대신택배</option>
                      <option value="GS편의점택배">GS편의점택배</option>
                      <option value="EMS">EMS (국제우편)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">운송장 번호</label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="운송장 번호 입력"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-200 focus:border-indigo-500"
                    />
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!trackingCompany || !trackingNumber) {
                      alert('택배사와 운송장 번호를 모두 입력해주세요.');
                      return;
                    }
                    await handleStatusChange(selectedOrder.id, 'SHIPPING', {
                      company: trackingCompany,
                      number: trackingNumber,
                    });
                    setSelectedOrder(null);
                    setTrackingCompany('');
                    setTrackingNumber('');
                  }}
                  className="mt-4 w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl font-bold hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-lg"
                >
                  🚚 운송장 등록 및 배송중 처리
                </button>
              </div>
            </div>

            <div className="px-8 py-6 bg-gray-50 border-t-2 border-gray-200">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl hover:from-blue-700 hover:to-blue-800 font-black text-lg shadow-lg hover:scale-105 transition-all"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
