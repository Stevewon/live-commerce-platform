'use client';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/auth/clientFetch';

interface Order {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  createdAt: string;
  paymentMethod: string | null;
  paymentKey: string | null;
  paidAt: string | null;
  refundAmount: number | null;
  refundedAt: string | null;
  cancelledAt: string | null;
  shippingName: string | null;
  shippingPhone: string | null;
  shippingAddress: string | null;
  trackingCompany: string | null;
  trackingNumber: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  user: {
    name: string;
    email: string;
  } | null;
  partner: {
    storeName: string;
  } | null;
  // ★ [2026-05-13 v1.0.19 HOTFIX] items / product 옵셔널 처리 (D1 wrapper select 모드 누락 + 상품 삭제 케이스)
  items: {
    id: string;
    quantity: number;
    price: number;
    productName?: string | null;
    productThumbnail?: string | null;
    product: {
      name: string;
      price: number;
    } | null;
  }[] | null | undefined;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_LABELS: Record<string, string> = {
  ALL: '전체',
  PENDING: '발송준비',
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
  const [appliedSearch, setAppliedSearch] = useState('');  // 실제 검색에 사용되는 값 (Enter/버튼 클릭 시에만 갱신)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingCompany, setTrackingCompany] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [exporting, setExporting] = useState(false);
  const [cancelProcessing, setCancelProcessing] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  // [일괄 작업] 체크박스로 선택한 주문 ID 집합 + 일괄 상태변경 진행 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  // [중복주문 정리] 처리 상태
  const [dedupeProcessing, setDedupeProcessing] = useState(false);

  // 현재 페이지 주문이 바뀌면(검색/필터/페이지 이동) 선택을 초기화한다.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [orders]);

  // 현재 페이지의 전체 선택 여부
  const allSelected = orders.length > 0 && orders.every((o) => selectedIds.has(o.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      loadOrders();
    }
  }, [user, statusFilter, pagination.page, appliedSearch]);

  const loadOrders = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        status: statusFilter,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (appliedSearch) {
        params.append('search', appliedSearch);
      }

      const res = await authFetch(`/api/admin/orders?${params}`);

      if (!res.ok) throw new Error('주문 목록 로드 실패');

      const data = await res.json();
      // [주문목록 최신순 보장] 서버가 정렬해 주지만, 클라이언트에서도 createdAt 내림차순으로 한 번 더 정렬
      const sortedOrders = [...(data.orders || [])].sort(
        (a: any, b: any) =>
          new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
      );
      setOrders(sortedOrders);
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

      const res = await authFetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
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
    setAppliedSearch(searchQuery.trim());
    setPagination({ ...pagination, page: 1 });
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);

      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const res = await authFetch(`/api/admin/orders/export?${params}`);

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

  // [중복주문 정리] 같은 회원의 "동일 상품 + 동일 금액" 중복 주문을
  //   마지막(최신) 1건만 남기고 전부 취소 + 환불. 먼저보기(dryRun) → 확인 → 실행 2단계.
  const handleDedupe = async () => {
    if (dedupeProcessing) return;
    try {
      setDedupeProcessing(true);

      // 1) 먼저보기: 무엇을 지울지 리포트만 (실제 취소 X)
      const previewRes = await authFetch('/api/admin/orders/dedupe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      });
      const preview = await previewRes.json();
      if (!previewRes.ok || !preview?.success) {
        throw new Error(preview?.error || '중복주문 검사에 실패했습니다.');
      }

      const clusters = Number(preview.duplicateClusters) || 0;
      const toCancel = Number(preview.ordersToCancel) || 0;

      if (toCancel === 0) {
        alert('정리할 중복 주문이 없습니다. 👍');
        return;
      }

      // 취소될 주문번호 미리보기 (최대 20건 표기)
      const cancelList: string[] = [];
      const keepList: string[] = [];
      if (Array.isArray(preview.detail)) {
        for (const c of preview.detail) {
          if (c?.keep) keepList.push(c.keep);
          if (Array.isArray(c?.cancel)) for (const x of c.cancel) if (x?.orderNumber) cancelList.push(x.orderNumber);
        }
      }
      const sample = cancelList.slice(0, 20).map((n) => `• ${n}`).join('\n');
      const more = cancelList.length > 20 ? `\n…외 ${cancelList.length - 20}건` : '';

      const ok = window.confirm(
        `중복 주문 ${clusters}개 그룹 발견\n` +
        `→ 각 그룹의 "마지막(최신) 1건"만 남기고 총 ${toCancel}건을 취소·환불합니다.\n\n` +
        `[취소될 주문]\n${sample}${more}\n\n` +
        `정말 실행할까요? (되돌릴 수 없습니다)`
      );
      if (!ok) return;

      // 2) 실제 실행
      const runRes = await authFetch('/api/admin/orders/dedupe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      });
      const run = await runRes.json();
      if (!runRes.ok || !run?.success) {
        throw new Error(run?.error || '중복주문 정리에 실패했습니다.');
      }

      const cancelled = Number(run.ordersCancelled) || 0;
      const refunded = Number(run.ordersRefunded) || 0;
      const failed = Array.isArray(run.failed) ? run.failed.length : 0;
      alert(
        `중복 주문 정리 완료 ✅\n\n` +
        `• 취소: ${cancelled}건\n` +
        `• 환불: ${refunded}건\n` +
        (failed > 0 ? `• 실패: ${failed}건 (콘솔 확인)\n` : '') +
        `\n각 그룹의 마지막 1건은 그대로 보존됐습니다.`
      );

      // 목록 새로고침
      await loadOrders();
    } catch (error: any) {
      console.error('Dedupe error:', error);
      alert(error?.message || '중복주문 정리 중 오류가 발생했습니다.');
    } finally {
      setDedupeProcessing(false);
    }
  };

  // [주문 삭제] 취소/환불된 주문을 목록에서 영구 삭제한다.
  const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
    if (!window.confirm(`주문 ${orderNumber} 을(를) 목록에서 영구 삭제할까요?\n(취소/환불된 주문만 삭제되며, 되돌릴 수 없습니다)`)) return;
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || '주문 삭제에 실패했습니다.');
      }
      await loadOrders();
    } catch (error: any) {
      console.error('Delete order error:', error);
      alert(error?.message || '주문 삭제 중 오류가 발생했습니다.');
    }
  };

  // [취소주문 전체삭제] 현재 필터/검색 조건의 취소·환불 주문을 한꺼번에 삭제한다.
  const handleDeleteAllCancelled = async () => {
    // 화면상 취소/환불 상태인 주문만 대상
    const targets = orders.filter((o) => o.status === 'CANCELLED' || o.status === 'REFUNDED');
    if (targets.length === 0) {
      alert('현재 목록에 삭제할 취소/환불 주문이 없습니다.');
      return;
    }
    if (!window.confirm(`현재 목록의 취소/환불 주문 ${targets.length}건을 영구 삭제할까요?\n(되돌릴 수 없습니다)`)) return;
    let ok = 0, fail = 0;
    for (const o of targets) {
      try {
        const res = await authFetch(`/api/admin/orders/${o.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data?.success) ok++; else fail++;
      } catch { fail++; }
    }
    alert(`삭제 완료 ✅\n\n• 삭제: ${ok}건${fail > 0 ? `\n• 실패: ${fail}건` : ''}`);
    await loadOrders();
  };

  // [선택 다운로드] 체크한 주문만 엑셀(CSV)로 내려받는다.
  const handleExportSelected = async () => {
    if (selectedIds.size === 0) {
      alert('다운로드할 주문을 먼저 선택해주세요.');
      return;
    }
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.append('ids', Array.from(selectedIds).join(','));

      const res = await authFetch(`/api/admin/orders/export?${params}`);
      if (!res.ok) throw new Error('다운로드 실패');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const disposition = res.headers.get('Content-Disposition');
      let fileName = `orders_selected_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
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
      console.error('Export selected error:', error);
      alert('선택 주문 다운로드에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  };

  // [선택 일괄 상태변경] 체크한 주문들의 상태를 한꺼번에 변경한다.
  const handleBulkStatusChange = async () => {
    if (selectedIds.size === 0) {
      alert('상태를 변경할 주문을 먼저 선택해주세요.');
      return;
    }
    if (!bulkStatus) {
      alert('변경할 상태를 선택해주세요.');
      return;
    }
    const ids = Array.from(selectedIds);
    if (!confirm(`선택한 ${ids.length}건의 주문 상태를 "${STATUS_LABELS[bulkStatus]}"(으)로 변경하시겠습니까?`)) {
      return;
    }
    try {
      setBulkProcessing(true);
      let success = 0;
      let fail = 0;
      // 서버 부하를 줄이려 순차 처리(주문 건수는 페이지당 최대 limit 개로 제한적)
      for (const id of ids) {
        try {
          const res = await authFetch(`/api/admin/orders/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: bulkStatus }),
          });
          if (res.ok) success++;
          else fail++;
        } catch {
          fail++;
        }
      }
      alert(`일괄 상태 변경 완료\n\n성공: ${success}건${fail > 0 ? `\n실패: ${fail}건` : ''}`);
      setBulkStatus('');
      setSelectedIds(new Set());
      loadOrders();
    } catch (error) {
      console.error('Bulk status change error:', error);
      alert('일괄 상태 변경에 실패했습니다.');
    } finally {
      setBulkProcessing(false);
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
      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm inline-flex items-center gap-1 ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'}`}>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                <span className="text-xl">📦</span>
              </div>
              <div>
                <h1 className="text-2xl font-black text-white drop-shadow">
                  주문 관리 시스템
                </h1>
                <p className="mt-0.5 text-blue-200 text-xs font-medium">Enterprise Order Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl px-6 py-3 border border-white/20">
                <div className="text-sm text-blue-200 font-medium">관리자</div>
                <div className="text-lg font-bold text-white">{user?.name}</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-black text-lg shadow-lg ring-2 ring-white/20 hover:scale-105 transition-transform cursor-pointer">
                {user?.name?.charAt(0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Premium Navigation */}
        <div className="mb-5">
          <div className="bg-white rounded-2xl shadow-md p-2 flex flex-wrap gap-2 border border-gray-200">
            <Link href="/admin" className="group px-4 py-2.5 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-semibold text-sm flex items-center gap-2 whitespace-nowrap hover:scale-105 duration-200">
              <span className="text-lg">📊</span>
              <span>대시보드</span>
            </Link>
            <Link href="/admin/users" className="group px-4 py-2.5 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-semibold text-sm flex items-center gap-2 whitespace-nowrap hover:scale-105 duration-200">
              <span className="text-lg">👥</span>
              <span>회원 관리</span>
            </Link>
            <Link href="/admin/orders" className="group px-4 py-2.5 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-700 text-white rounded-xl shadow-xl font-semibold text-sm flex items-center gap-2 whitespace-nowrap shadow-md">
              <span className="text-lg">📦</span>
              <span>주문 관리</span>
            </Link>
            <Link href="/admin/balance-requests" className="group px-4 py-2.5 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-semibold text-sm flex items-center gap-2 whitespace-nowrap hover:scale-105 duration-200">
              <span className="text-lg">💳</span>
              <span>충전 신청</span>
            </Link>
            <Link href="/admin/partners" className="group px-4 py-2.5 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-semibold text-sm flex items-center gap-2 whitespace-nowrap hover:scale-105 duration-200">
              <span className="text-lg">🤝</span>
              <span>파트너 관리</span>
            </Link>
            <Link href="/admin/products" className="group px-4 py-2.5 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-semibold text-sm flex items-center gap-2 whitespace-nowrap hover:scale-105 duration-200">
              <span className="text-lg">🛍️</span>
              <span>상품 관리</span>
            </Link>
            <Link href="/admin/reports" className="group px-4 py-2.5 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-semibold text-sm flex items-center gap-2 whitespace-nowrap hover:scale-105 duration-200">
              <span className="text-lg">📈</span>
              <span>매출 리포트</span>
            </Link>
          </div>
        </div>

        {/* Premium Statistics */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="group bg-gradient-to-br from-white to-purple-50 rounded-2xl shadow-lg p-4 border-t-4 border-purple-500 hover:shadow-purple-200 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="text-xs font-black text-purple-600 uppercase tracking-wider mb-2">📊 전체 주문</div>
            <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 group-hover:scale-110 transition-transform">
              {pagination.total}
            </div>
            <div className="text-xs text-gray-500 mt-2 font-semibold">Total Orders</div>
          </div>

          <div className="group bg-gradient-to-br from-white to-yellow-50 rounded-2xl shadow-lg p-4 border-t-4 border-yellow-500 hover:shadow-yellow-200 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="text-xs font-black text-yellow-600 uppercase tracking-wider mb-2">⏳ 발송준비</div>
            <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-orange-600 group-hover:scale-110 transition-transform">
              {orders.filter(o => o.status === 'PENDING').length}
            </div>
            <div className="text-xs text-gray-500 mt-2 font-semibold">Pending</div>
          </div>

          <div className="group bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg p-4 border-t-4 border-blue-500 hover:shadow-blue-200 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="text-xs font-black text-blue-600 uppercase tracking-wider mb-2">🚚 배송중</div>
            <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600 group-hover:scale-110 transition-transform">
              {orders.filter(o => o.status === 'SHIPPING').length}
            </div>
            <div className="text-xs text-gray-500 mt-2 font-semibold">Shipping</div>
          </div>

          <div className="group bg-gradient-to-br from-white to-emerald-50 rounded-2xl shadow-lg p-4 border-t-4 border-emerald-500 hover:shadow-emerald-200 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-2">✅ 완료</div>
            <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-green-600 group-hover:scale-110 transition-transform">
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
                className={`px-4 py-2.5 rounded-2xl font-black transition-all duration-300 shadow-lg flex items-center space-x-2 ${
                  statusFilter === status
                    ? 'bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-700 text-white shadow-blue-300 scale-110 ring-4 ring-blue-200'
                    : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 hover:from-blue-50 hover:to-blue-100 hover:scale-105'
                }`}
              >
                <span className="text-sm">{STATUS_ICONS[status] || '📋'}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1 relative group">
              <input
                type="text"
                placeholder="주문번호, 주문자, 수령인, 연락처, 이메일로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all text-sm font-medium bg-white group-hover:border-blue-400 placeholder:text-gray-400"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 text-base">
                🔍
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setAppliedSearch('');
                    setPagination({ ...pagination, page: 1 });
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              )}
            </div>
            <button type="submit" className="px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 font-bold text-sm shadow hover:scale-105 transition-all">
              검색
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting}
              className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 font-bold text-sm shadow hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {exporting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>다운로드 중...</span>
                </>
              ) : (
                <>
                  <span className="text-base">📥</span>
                  <span>엑셀 다운로드</span>
                </>
              )}
            </button>
            <Link
              href="/admin/orders/bulk"
              className="px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 font-bold text-sm shadow hover:scale-105 transition-all flex items-center space-x-2"
            >
              <span className="text-base">🚚</span>
              <span>송장 대량등록</span>
            </Link>
            <button
              type="button"
              onClick={handleDedupe}
              disabled={dedupeProcessing}
              title="같은 회원의 동일 상품·동일 금액 중복 주문을 마지막 1건만 남기고 취소·환불합니다"
              className="px-5 py-3 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-xl hover:from-rose-600 hover:to-red-700 font-bold text-sm shadow hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {dedupeProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>정리 중...</span>
                </>
              ) : (
                <>
                  <span className="text-base">🧹</span>
                  <span>중복주문 정리</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDeleteAllCancelled}
              title="현재 목록의 취소/환불된 주문을 모두 영구 삭제합니다"
              className="px-5 py-3 bg-gradient-to-r from-gray-600 to-gray-800 text-white rounded-xl hover:from-gray-700 hover:to-gray-900 font-bold text-sm shadow hover:scale-105 transition-all flex items-center space-x-2"
            >
              <span className="text-base">🗑</span>
              <span>취소주문 삭제</span>
            </button>
          </form>
        </div>

        {/* Premium Orders Table */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200">
          <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-blue-50 border-b-2 border-gray-200 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-black text-gray-900 flex items-center">
              <span className="text-3xl mr-3">📋</span>
              주문 목록 ({pagination.total}건)
            </h2>
            {someSelected && (
              <div className="text-sm font-bold text-blue-700">
                ✅ {selectedIds.size}건 선택됨
              </div>
            )}
          </div>

          {/* [일괄 작업 바] 체크박스로 주문을 선택하면 나타난다.
               - 선택 주문 엑셀 다운로드
               - 선택 주문 상태 일괄 변경 */}
          {someSelected && (
            <div className="px-8 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200 flex flex-wrap items-center gap-3">
              <span className="text-sm font-black text-blue-800 flex items-center gap-1">
                <span className="text-lg">🗂️</span>
                선택 {selectedIds.size}건 일괄 작업:
              </span>

              {/* 선택 다운로드 */}
              <button
                type="button"
                onClick={handleExportSelected}
                disabled={exporting}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 font-black text-sm shadow-md hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {exporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>다운로드 중...</span>
                  </>
                ) : (
                  <>
                    <span>📥</span>
                    <span>선택 항목 엑셀 다운로드</span>
                  </>
                )}
              </button>

              {/* 선택 상태 일괄 변경 */}
              <div className="flex items-center gap-2">
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  disabled={bulkProcessing}
                  className="px-4 py-2.5 border-2 border-blue-300 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-200 focus:border-blue-500 bg-white shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <option value="">상태 변경 선택...</option>
                  <option value="PENDING">⏳ 발송준비</option>
                  <option value="CONFIRMED">✅ 확인됨</option>
                  <option value="SHIPPING">🚚 배송중</option>
                  <option value="DELIVERED">📦 배송완료</option>
                  <option value="CANCELLED">❌ 취소됨</option>
                  <option value="REFUNDED">💸 환불됨</option>
                </select>
                <button
                  type="button"
                  onClick={handleBulkStatusChange}
                  disabled={bulkProcessing || !bulkStatus}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 font-black text-sm shadow-md hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {bulkProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>처리 중...</span>
                    </>
                  ) : (
                    <>
                      <span>🔄</span>
                      <span>선택 항목 상태 일괄 변경</span>
                    </>
                  )}
                </button>
              </div>

              {/* 선택 해제 */}
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                disabled={bulkProcessing}
                className="px-4 py-2.5 bg-white text-gray-600 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-bold text-sm shadow-sm transition-all disabled:opacity-50"
              >
                선택 해제
              </button>
            </div>
          )}

          {orders.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-gray-500 font-bold text-base">주문이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-800 via-blue-900 to-indigo-900 border-b-4 border-blue-500">
                    <th className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label="전체 선택"
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-400 cursor-pointer accent-blue-600"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white tracking-wide">
                      🔢 주문번호
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white tracking-wide">
                      👤 주문자
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white tracking-wide">
                      📬 수령인
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white tracking-wide">
                      💰 주문금액
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white tracking-wide">
                      💳 결제정보
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white tracking-wide">
                      📊 상태
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white tracking-wide">
                      🕐 주문일시
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-white tracking-wide">
                      ⚙️ 관리
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className={`transition-all duration-200 group ${
                        selectedIds.has(order.id)
                          ? 'bg-blue-50/70'
                          : 'hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50'
                      }`}
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(order.id)}
                          onChange={() => toggleSelectOne(order.id)}
                          aria-label={`주문 ${order.orderNumber} 선택`}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-400 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="font-mono text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline text-left"
                        >
                          {order.orderNumber}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-sm font-bold text-gray-900">
                            {order.user?.name || '비회원'}
                          </div>
                          <div className="text-xs text-gray-600 font-medium mt-0.5">
                            {order.user?.email || order.guestEmail || '-'}
                          </div>
                          {order.guestPhone && (
                            <div className="text-xs text-gray-500 font-medium mt-0.5">
                              📱 {order.guestPhone}
                            </div>
                          )}
                          {!order.user && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">비회원</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-sm font-bold text-gray-900">
                            {order.shippingName || '-'}
                          </div>
                          <div className="text-xs text-gray-500 font-medium mt-0.5">
                            📱 {order.shippingPhone || '-'}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-base font-black text-purple-700">
                          {formatCurrency(order.total)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {order.paymentKey ? (
                          <div className="space-y-1">
                            <div className="text-xs font-bold text-gray-500">TID</div>
                            <div className="font-mono text-xs text-gray-900 break-all max-w-[200px]" title={order.paymentKey}>
                              {order.paymentKey}
                            </div>
                            {order.paidAt && (
                              <div className="text-xs text-emerald-700 font-bold mt-1">
                                💚 {formatDate(order.paidAt)}
                              </div>
                            )}
                            <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full">결제완료</span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-black rounded-full">⚠️ TID 미등록</span>
                            <div className="text-[10px] text-gray-400 font-medium">상세에서 수동 등록 가능</div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(order.status)}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700 font-bold">
                          {formatDate(order.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={order.status}
                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-300 focus:border-blue-500 hover:border-blue-400 transition-all cursor-pointer bg-white"
                          >
                            <option value="PENDING">⏳ 발송준비</option>
                            <option value="CONFIRMED">✅ 확인됨</option>
                            <option value="SHIPPING">🚚 배송중</option>
                            <option value="DELIVERED">📦 배송완료</option>
                            <option value="CANCELLED">❌ 취소됨</option>
                            <option value="REFUNDED">💸 환불됨</option>
                          </select>
                          {(order.status === 'CANCELLED' || order.status === 'REFUNDED') && (
                            <button
                              type="button"
                              onClick={() => handleDeleteOrder(order.id, order.orderNumber)}
                              title="이 주문을 목록에서 영구 삭제"
                              className="px-2 py-1.5 bg-gray-100 text-gray-600 border border-gray-300 rounded-lg text-xs font-semibold hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all"
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Premium Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-blue-50 border-t-2 border-gray-200 flex items-center justify-between">
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
            <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex justify-between items-center">
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
            
            <div className="px-4 py-3 space-y-6">
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
                  주문자 정보
                  {!selectedOrder.user && (
                    <span className="ml-2 px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">비회원</span>
                  )}
                </h4>
                <div className="space-y-3 text-base">
                  <div className="flex justify-between items-center bg-white rounded-xl p-4">
                    <span className="text-gray-600 font-bold">이름:</span>
                    <span className="font-black text-gray-900">{selectedOrder.user?.name || '비회원 주문'}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white rounded-xl p-4">
                    <span className="text-gray-600 font-bold">이메일:</span>
                    <span className="font-bold text-gray-700">{selectedOrder.user?.email || selectedOrder.guestEmail || '-'}</span>
                  </div>
                  {selectedOrder.guestPhone && (
                    <div className="flex justify-between items-center bg-white rounded-xl p-4">
                      <span className="text-gray-600 font-bold">연락처 (비회원):</span>
                      <span className="font-bold text-gray-700">{selectedOrder.guestPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-br from-cyan-50 to-teal-50 rounded-2xl p-6 border-2 border-cyan-200">
                <h4 className="font-black text-gray-900 mb-4 text-lg flex items-center">
                  <span className="text-2xl mr-2">📬</span>
                  수령인 / 배송지 정보
                </h4>
                <div className="space-y-3 text-base">
                  <div className="flex justify-between items-center bg-white rounded-xl p-4">
                    <span className="text-gray-600 font-bold">수령인:</span>
                    <span className="font-black text-gray-900">{selectedOrder.shippingName || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white rounded-xl p-4">
                    <span className="text-gray-600 font-bold">연락처:</span>
                    <span className="font-bold text-gray-700">{selectedOrder.shippingPhone || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white rounded-xl p-4">
                    <span className="text-gray-600 font-bold">배송지:</span>
                    <span className="font-bold text-gray-700 text-right max-w-[60%]">{selectedOrder.shippingAddress || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200">
                <h4 className="font-black text-gray-900 mb-4 text-lg flex items-center">
                  <span className="text-2xl mr-2">🛍️</span>
                  주문 상품
                </h4>
                <div className="space-y-3">
                  {/* ★ [2026-05-13 v1.0.19 HOTFIX] 증상 #4 (어드민 주문 클릭 오류) 방어 패치 ★
                       1) selectedOrder.items 가 undefined/null 인 경우 빈 배열로 기본화
                          → D1 wrapper 가 select 모드에서 관계 누락하는 사례 방어
                       2) item.product 가 null 인 경우 (상품 삭제됨) name/price 옵셔널 체이닝
                          → 과거 주문 중 상품이 삭제된 케이스에서 TypeError 차단 */}
                  {(selectedOrder.items || []).length === 0 ? (
                    <div className="bg-white rounded-xl p-5 text-center text-gray-500 font-bold">
                      주문 상품 정보가 없습니다
                    </div>
                  ) : (
                    (selectedOrder.items || []).map((item) => (
                      <div
                        key={item?.id || Math.random().toString(36)}
                        className="bg-white rounded-xl p-5 flex justify-between items-center border-2 border-purple-100 hover:border-purple-300 transition-all"
                      >
                        <div>
                          <div className="font-black text-gray-900 text-lg">{item?.product?.name || item?.productName || '주문 상품'}</div>
                          <div className="text-sm text-gray-600 font-bold mt-1">
                            {formatCurrency(item?.price || 0)} × {item?.quantity || 0}개
                          </div>
                        </div>
                        <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                          {formatCurrency((item?.price || 0) * (item?.quantity || 0))}
                        </div>
                      </div>
                    ))
                  )}
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

              {/* 결제 정보 */}
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-6 border-2 border-amber-200">
                <h4 className="font-black text-gray-900 mb-4 text-lg flex items-center">
                  <span className="text-2xl mr-2">💳</span>
                  결제 정보
                </h4>
                <div className="space-y-3 text-base">
                  <div className="flex justify-between items-center bg-white rounded-xl p-4">
                    <span className="text-gray-600 font-bold">결제수단:</span>
                    <span className="font-black text-gray-900">{selectedOrder.paymentMethod || '미결제'}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white rounded-xl p-4">
                    <span className="text-gray-600 font-bold">거래번호 (TID):</span>
                    <span className="font-mono font-bold text-gray-700 text-sm">{selectedOrder.paymentKey || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white rounded-xl p-4">
                    <span className="text-gray-600 font-bold">결제일시:</span>
                    <span className="font-bold text-gray-900">{selectedOrder.paidAt ? formatDate(selectedOrder.paidAt) : '-'}</span>
                  </div>
                  {selectedOrder.refundAmount && (
                    <div className="flex justify-between items-center bg-red-50 rounded-xl p-4 border border-red-200">
                      <span className="text-red-600 font-bold">환불금액:</span>
                      <span className="font-black text-red-600">{formatCurrency(selectedOrder.refundAmount)}</span>
                    </div>
                  )}
                  {selectedOrder.refundedAt && (
                    <div className="flex justify-between items-center bg-red-50 rounded-xl p-4 border border-red-200">
                      <span className="text-red-600 font-bold">환불일시:</span>
                      <span className="font-bold text-red-600">{formatDate(selectedOrder.refundedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 결제 정보 수동 등록 (paymentKey가 없는 경우) */}
              {!selectedOrder.paymentKey && 
               selectedOrder.status !== 'CANCELLED' && 
               selectedOrder.status !== 'REFUNDED' && (
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-6 border-2 border-yellow-300">
                  <h4 className="font-black text-yellow-800 mb-3 text-lg flex items-center">
                    <span className="text-2xl mr-2">⚠️</span>
                    결제 정보 미등록
                  </h4>
                  <p className="text-sm text-yellow-700 mb-4 font-medium">
                    이 주문의 거래번호(TID)가 등록되어 있지 않습니다. 필요한 경우 아래에 거래번호를 입력해주세요.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-bold text-yellow-800 mb-1">거래번호 (TID)</label>
                      <input
                        type="text"
                        id="manualTidInput"
                        placeholder="거래번호 (TID)를 입력하세요"
                        className="w-full px-4 py-3 border-2 border-yellow-300 rounded-xl text-sm font-mono font-medium focus:ring-4 focus:ring-yellow-200 focus:border-yellow-500 bg-white"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        const tidInput = (document.getElementById('manualTidInput') as HTMLInputElement)?.value?.trim();
                        if (!tidInput) {
                          alert('거래번호(TID)를 입력해주세요.');
                          return;
                        }
                        if (!confirm(`거래번호(TID)를 등록하시겠습니까?\n\nTID: ${tidInput}`)) return;
                        try {
                          const res = await authFetch(`/api/admin/orders/${selectedOrder.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({
                              paymentKey: tidInput,
                              paymentMethod: '신용카드',
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || '등록 실패');
                          alert('결제 정보가 등록되었습니다. 이제 카드 취소가 가능합니다.');
                          setSelectedOrder({ ...selectedOrder, paymentKey: tidInput, paymentMethod: '신용카드' });
                          loadOrders();
                        } catch (error: any) {
                          alert('결제 정보 등록 실패: ' + (error.message || '알 수 없는 오류'));
                        }
                      }}
                      className="w-full px-6 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded-xl font-black hover:from-yellow-600 hover:to-amber-600 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <span className="text-xl">💾</span>
                      <span>거래번호(TID) 등록</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 카드 결제 취소/환불 버튼 - paymentKey가 있거나 수동 TID 입력 가능 */}
              {selectedOrder.status !== 'CANCELLED' && 
               selectedOrder.status !== 'REFUNDED' && (
                <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl p-6 border-2 border-red-200">
                  <h4 className="font-black text-red-700 mb-4 text-lg flex items-center">
                    <span className="text-2xl mr-2">🔴</span>
                    주문 취소 / 카드 결제 취소
                  </h4>
                  {selectedOrder.paymentKey ? (
                    <p className="text-sm text-red-600 mb-4 font-medium">
                      카드 결제를 취소하면 고객의 카드로 환불됩니다. 이 작업은 되돌릴 수 없습니다.
                    </p>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-3 mb-4">
                      <p className="text-sm text-yellow-800 font-bold">
                        ⚠️ 거래번호(TID)가 등록되어 있지 않습니다.
                      </p>
                      <p className="text-xs text-yellow-700 mt-1">
                        실제 결제가 완료된 경우 위의 &quot;결제 정보 수동 등록&quot;에서 TID를 먼저 등록하거나, 아래에 TID를 직접 입력하여 취소할 수 있습니다.
                      </p>
                      <div className="mt-2">
                        <input
                          type="text"
                          id="cancelManualTidInput"
                          placeholder="수동 TID 입력 (선택사항)"
                          className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-yellow-300 bg-white"
                        />
                      </div>
                    </div>
                  )}
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-red-700 mb-2">취소 사유</label>
                    <input
                      type="text"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="취소 사유를 입력하세요 (선택)"
                      className="w-full px-4 py-3 border-2 border-red-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-red-200 focus:border-red-400"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      disabled={cancelProcessing}
                      onClick={async () => {
                        const manualTid = !selectedOrder.paymentKey 
                          ? (document.getElementById('cancelManualTidInput') as HTMLInputElement)?.value?.trim() 
                          : undefined;
                        const tidToUse = selectedOrder.paymentKey || manualTid;
                        
                        const confirmMsg = tidToUse
                          ? `정말 카드 결제를 취소하시겠습니까?\n\n주문번호: ${selectedOrder.orderNumber}\n결제금액: ${formatCurrency(selectedOrder.total)}\n거래번호: ${tidToUse}\n\n카드 결제 취소 후 고객에게 환불됩니다.`
                          : `주문을 취소하시겠습니까?\n\n주문번호: ${selectedOrder.orderNumber}\n결제금액: ${formatCurrency(selectedOrder.total)}\n\n주문 상태를 취소로 변경합니다.`;
                        
                        if (!confirm(confirmMsg)) return;
                        
                        try {
                          setCancelProcessing(true);
                          const bodyData: any = {
                            status: 'CANCELLED',
                            cancelReason: cancelReason || '관리자에 의한 주문 취소',
                          };
                          if (manualTid) bodyData.manualTid = manualTid;
                          
                          const res = await authFetch(`/api/admin/orders/${selectedOrder.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify(bodyData),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || '취소 실패');
                          
                          let alertMsg = '';
                          if (data.pgCancelSuccess) {
                            alertMsg = '✅ 주문 취소 및 카드 결제 취소가 완료되었습니다.\n\n카드 환불이 진행됩니다.';
                          } else if (data.warning) {
                            alertMsg = '주문 상태는 변경되었습니다.\n\n⚠️ 주의: ' + data.warning;
                          } else if (tidToUse) {
                            alertMsg = '주문 취소가 처리되었습니다.\n\n카드 환불이 진행됩니다.';
                          } else {
                            alertMsg = '주문 취소가 처리되었습니다.';
                          }
                          alert(alertMsg);
                          setSelectedOrder(null);
                          setCancelReason('');
                          loadOrders();
                        } catch (error: any) {
                          alert('취소 처리 실패: ' + (error.message || '알 수 없는 오류'));
                        } finally {
                          setCancelProcessing(false);
                        }
                      }}
                      className="flex-1 px-6 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-black hover:from-red-600 hover:to-red-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {cancelProcessing ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          <span>취소 처리 중...</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xl">❌</span>
                          <span>{selectedOrder.paymentKey ? '주문 취소 + 카드 환불' : '주문 취소'}</span>
                        </>
                      )}
                    </button>
                    <button
                      disabled={cancelProcessing}
                      onClick={async () => {
                        const manualTid = !selectedOrder.paymentKey 
                          ? (document.getElementById('cancelManualTidInput') as HTMLInputElement)?.value?.trim() 
                          : undefined;
                        const tidToUse = selectedOrder.paymentKey || manualTid;
                        
                        if (!confirm(`환불 처리하시겠습니까?\n\n주문번호: ${selectedOrder.orderNumber}\n결제금액: ${formatCurrency(selectedOrder.total)}\n${tidToUse ? `거래번호: ${tidToUse}\n` : ''}\n주문 상태를 환불됨으로 변경합니다.`)) {
                          return;
                        }
                        try {
                          setCancelProcessing(true);
                          const bodyData: any = {
                            status: 'REFUNDED',
                            cancelReason: cancelReason || '관리자에 의한 환불 처리',
                          };
                          if (manualTid) bodyData.manualTid = manualTid;
                          
                          const res = await authFetch(`/api/admin/orders/${selectedOrder.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify(bodyData),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || '환불 실패');
                          
                          let alertMsg = '';
                          if (data.pgCancelSuccess) {
                            alertMsg = '✅ 환불 처리 및 카드 결제 취소가 완료되었습니다.';
                          } else if (data.warning) {
                            alertMsg = '환불 상태로 변경되었습니다.\n\n⚠️ 주의: ' + data.warning;
                          } else {
                            alertMsg = '환불 처리가 완료되었습니다.';
                          }
                          alert(alertMsg);
                          setSelectedOrder(null);
                          setCancelReason('');
                          loadOrders();
                        } catch (error: any) {
                          alert('환불 처리 실패: ' + (error.message || '알 수 없는 오류'));
                        } finally {
                          setCancelProcessing(false);
                        }
                      }}
                      className="flex-1 px-6 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-black hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {cancelProcessing ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          <span>환불 처리 중...</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xl">💸</span>
                          <span>환불 처리</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* 이미 취소/환불된 경우 안내 */}
              {(selectedOrder.status === 'CANCELLED' || selectedOrder.status === 'REFUNDED') && (
                <div className="bg-gray-100 rounded-2xl p-6 border-2 border-gray-300">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{selectedOrder.status === 'CANCELLED' ? '❌' : '💸'}</span>
                    <div>
                      <p className="font-black text-gray-700">
                        {selectedOrder.status === 'CANCELLED' ? '취소된 주문입니다' : '환불 처리된 주문입니다'}
                      </p>
                      {selectedOrder.cancelledAt && (
                        <p className="text-sm text-gray-500 font-medium mt-1">
                          처리일시: {formatDate(selectedOrder.cancelledAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

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

            <div className="px-4 py-3 bg-gray-50 border-t-2 border-gray-200">
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
