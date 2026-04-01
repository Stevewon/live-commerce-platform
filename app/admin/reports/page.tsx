'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

interface MonthlyData {
  month: number;
  totalSales: number;
  totalOrders: number;
  cancelledAmount: number;
  cancelledOrders: number;
  refundedAmount: number;
  refundedOrders: number;
  confirmedSales: number;
  confirmedOrders: number;
  shippingOrders: number;
  deliveredOrders: number;
  pendingOrders: number;
  partnerRevenue: number;
  platformRevenue: number;
  avgOrderValue: number;
}

interface YearSummary {
  totalSales: number;
  totalOrders: number;
  cancelledAmount: number;
  cancelledOrders: number;
  refundedAmount: number;
  refundedOrders: number;
  partnerRevenue: number;
  platformRevenue: number;
}

interface CancellationOrder {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  cancelReason: string | null;
  cancelledAt: string | null;
  refundAmount: number | null;
  refundedAt: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
  partner: { storeName: string } | null;
  items: { quantity: number; price: number; product: { name: string } }[];
}

interface CancellationStats {
  totalCancelledRefunded: number;
  totalAmount: number;
  refundedAmount: number;
  cancelCount: number;
  refundCount: number;
  totalOrderCount: number;
  cancellationRate: number;
}

const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

export default function AdminReportsPage() {
  const { user, loading: authLoading } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<'monthly' | 'cancellations'>('monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Monthly data
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [summary, setSummary] = useState<YearSummary | null>(null);

  // Cancellation data
  const [cancellations, setCancellations] = useState<CancellationOrder[]>([]);
  const [cancelStats, setCancelStats] = useState<CancellationStats | null>(null);
  const [cancelPage, setCancelPage] = useState(1);
  const [cancelTotalPages, setCancelTotalPages] = useState(1);

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      if (activeTab === 'monthly') {
        loadMonthlyData();
      } else {
        loadCancellations();
      }
    }
  }, [user, activeTab, year, selectedMonth, cancelPage]);

  const loadMonthlyData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?type=monthly&year=${year}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setMonthlyData(data.monthlyData || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error('Load monthly data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCancellations = async () => {
    setLoading(true);
    try {
      let url = `/api/admin/reports?type=cancellations&year=${year}&page=${cancelPage}&limit=20`;
      if (selectedMonth) {
        url += `&month=${selectedMonth}`;
      }
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setCancellations(data.cancellations || []);
      setCancelStats(data.stats || null);
      setCancelTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      console.error('Load cancellations error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // 매출 바 차트 최대값 계산
  const maxSales = Math.max(...monthlyData.map(d => d.totalSales), 1);

  if (authLoading || (loading && monthlyData.length === 0 && cancellations.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-purple-200 border-t-purple-600 mx-auto mb-6"></div>
          <p className="text-gray-600 font-bold text-lg">리포트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 shadow-2xl border-b-4 border-indigo-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl">
                <span className="text-3xl">📊</span>
              </div>
              <div>
                <h1 className="text-4xl font-black text-white drop-shadow-lg">매출/취소 리포트</h1>
                <p className="mt-2 text-indigo-200 text-lg font-medium">Sales & Cancellation Reports</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl px-6 py-3 border border-white/20">
                <div className="text-sm text-indigo-200 font-medium">관리자</div>
                <div className="text-lg font-bold text-white">{user?.name}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-2xl p-3 inline-flex space-x-2 border border-gray-200 flex-wrap">
            <Link href="/admin" className="group px-8 py-4 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-bold flex items-center space-x-2 hover:scale-105 duration-200">
              <span className="text-2xl group-hover:scale-110 transition-transform">📊</span>
              <span>대시보드</span>
            </Link>
            <Link href="/admin/orders" className="group px-8 py-4 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-bold flex items-center space-x-2 hover:scale-105 duration-200">
              <span className="text-2xl group-hover:scale-110 transition-transform">📦</span>
              <span>주문 관리</span>
            </Link>
            <Link href="/admin/partners" className="group px-8 py-4 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-bold flex items-center space-x-2 hover:scale-105 duration-200">
              <span className="text-2xl group-hover:scale-110 transition-transform">🤝</span>
              <span>파트너 관리</span>
            </Link>
            <Link href="/admin/reports" className="group px-8 py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white rounded-xl shadow-xl font-bold flex items-center space-x-2 ring-4 ring-indigo-200 scale-105">
              <span className="text-2xl">📈</span>
              <span>매출 리포트</span>
            </Link>
          </div>
        </div>

        {/* Tab + Year Selector */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 mb-8 border border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-3">
              <button
                onClick={() => { setActiveTab('monthly'); setCancelPage(1); }}
                className={`px-8 py-4 rounded-2xl font-black transition-all duration-300 shadow-lg flex items-center space-x-2 ${
                  activeTab === 'monthly'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-indigo-300 scale-110 ring-4 ring-indigo-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:scale-105'
                }`}
              >
                <span className="text-xl">📈</span>
                <span>월별 매출</span>
              </button>
              <button
                onClick={() => { setActiveTab('cancellations'); setCancelPage(1); }}
                className={`px-8 py-4 rounded-2xl font-black transition-all duration-300 shadow-lg flex items-center space-x-2 ${
                  activeTab === 'cancellations'
                    ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-red-300 scale-110 ring-4 ring-red-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:scale-105'
                }`}
              >
                <span className="text-xl">❌</span>
                <span>취소/환불 내역</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setYear(y => y - 1)}
                className="px-4 py-3 bg-gray-200 rounded-xl hover:bg-gray-300 font-bold transition-all hover:scale-110"
              >
                ◀
              </button>
              <div className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-black text-xl shadow-lg">
                {year}년
              </div>
              <button
                onClick={() => setYear(y => y + 1)}
                disabled={year >= new Date().getFullYear()}
                className="px-4 py-3 bg-gray-200 rounded-xl hover:bg-gray-300 font-bold transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ▶
              </button>
              {activeTab === 'cancellations' && (
                <select
                  value={selectedMonth || ''}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value ? parseInt(e.target.value) : null);
                    setCancelPage(1);
                  }}
                  className="px-4 py-3 border-2 border-gray-300 rounded-xl font-bold focus:ring-4 focus:ring-indigo-200"
                >
                  <option value="">전체 월</option>
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx} value={idx + 1}>{name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Monthly Sales Tab */}
        {activeTab === 'monthly' && (
          <>
            {/* Year Summary Cards */}
            {summary && (
              <div className="grid md:grid-cols-4 gap-6 mb-8">
                <div className="group bg-gradient-to-br from-white to-blue-50 rounded-3xl shadow-2xl p-6 border-t-4 border-blue-500 hover:scale-105 transition-all duration-300">
                  <div className="text-xs font-black text-blue-600 uppercase tracking-wider mb-2">💰 연간 총 매출</div>
                  <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                    {formatCurrency(summary.totalSales)}
                  </div>
                  <div className="text-sm text-gray-500 mt-2 font-semibold">{summary.totalOrders}건 주문</div>
                </div>
                <div className="group bg-gradient-to-br from-white to-emerald-50 rounded-3xl shadow-2xl p-6 border-t-4 border-emerald-500 hover:scale-105 transition-all duration-300">
                  <div className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-2">✅ 순 매출</div>
                  <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-green-600">
                    {formatCurrency(summary.totalSales - summary.cancelledAmount - summary.refundedAmount)}
                  </div>
                  <div className="text-sm text-gray-500 mt-2 font-semibold">취소/환불 제외</div>
                </div>
                <div className="group bg-gradient-to-br from-white to-red-50 rounded-3xl shadow-2xl p-6 border-t-4 border-red-500 hover:scale-105 transition-all duration-300">
                  <div className="text-xs font-black text-red-600 uppercase tracking-wider mb-2">❌ 취소/환불</div>
                  <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-rose-600">
                    {formatCurrency(summary.cancelledAmount + summary.refundedAmount)}
                  </div>
                  <div className="text-sm text-gray-500 mt-2 font-semibold">
                    취소 {summary.cancelledOrders}건 / 환불 {summary.refundedOrders}건
                  </div>
                </div>
                <div className="group bg-gradient-to-br from-white to-purple-50 rounded-3xl shadow-2xl p-6 border-t-4 border-purple-500 hover:scale-105 transition-all duration-300">
                  <div className="text-xs font-black text-purple-600 uppercase tracking-wider mb-2">🤝 파트너 수익</div>
                  <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
                    {formatCurrency(summary.partnerRevenue)}
                  </div>
                  <div className="text-sm text-gray-500 mt-2 font-semibold">
                    플랫폼: {formatCurrency(summary.platformRevenue)}
                  </div>
                </div>
              </div>
            )}

            {/* Bar Chart */}
            <div className="bg-white rounded-3xl shadow-2xl p-8 mb-8 border border-gray-200">
              <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center">
                <span className="text-3xl mr-3">📊</span>
                {year}년 월별 매출 추이
              </h2>
              <div className="space-y-4">
                {monthlyData.map((data) => {
                  const barWidth = maxSales > 0 ? (data.totalSales / maxSales) * 100 : 0;
                  const cancelWidth = maxSales > 0 ? ((data.cancelledAmount + data.refundedAmount) / maxSales) * 100 : 0;
                  return (
                    <div key={data.month} className="group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 text-right font-black text-gray-700 text-sm">
                          {data.month}월
                        </div>
                        <div className="flex-1 relative">
                          <div className="h-10 bg-gray-100 rounded-xl overflow-hidden relative">
                            {/* Sales bar */}
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl transition-all duration-700 absolute left-0 top-0"
                              style={{ width: `${barWidth}%` }}
                            />
                            {/* Cancel bar overlay */}
                            {cancelWidth > 0 && (
                              <div
                                className="h-full bg-gradient-to-r from-red-400 to-rose-500 rounded-xl transition-all duration-700 absolute left-0 top-0 opacity-80"
                                style={{ width: `${cancelWidth}%` }}
                              />
                            )}
                          </div>
                        </div>
                        <div className="w-40 text-right">
                          <div className="font-black text-gray-900 text-sm">{formatCurrency(data.totalSales)}</div>
                          <div className="text-xs text-gray-500">{data.totalOrders}건</div>
                        </div>
                      </div>
                      {/* Hover detail */}
                      <div className="hidden group-hover:block ml-16 mt-2 mb-2 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200 text-sm">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <span className="text-gray-500">매출:</span>
                            <span className="font-bold text-blue-700 ml-1">{formatCurrency(data.confirmedSales)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">취소:</span>
                            <span className="font-bold text-red-600 ml-1">{formatCurrency(data.cancelledAmount)} ({data.cancelledOrders}건)</span>
                          </div>
                          <div>
                            <span className="text-gray-500">환불:</span>
                            <span className="font-bold text-orange-600 ml-1">{formatCurrency(data.refundedAmount)} ({data.refundedOrders}건)</span>
                          </div>
                          <div>
                            <span className="text-gray-500">평균 주문:</span>
                            <span className="font-bold text-purple-700 ml-1">{formatCurrency(data.avgOrderValue)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-6 mt-6 pt-4 border-t border-gray-200 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                  <span className="text-gray-600 font-medium">매출</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gradient-to-r from-red-400 to-rose-500"></div>
                  <span className="text-gray-600 font-medium">취소/환불</span>
                </div>
              </div>
            </div>

            {/* Monthly Detail Table */}
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
              <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-blue-50 border-b-2 border-gray-200">
                <h2 className="text-2xl font-black text-gray-900 flex items-center">
                  <span className="text-3xl mr-3">📋</span>
                  월별 상세 내역
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-800 via-indigo-900 to-slate-800 border-b-4 border-indigo-500">
                      <th className="px-6 py-5 text-left text-xs font-black text-white uppercase tracking-wider">월</th>
                      <th className="px-6 py-5 text-right text-xs font-black text-white uppercase tracking-wider">총 매출</th>
                      <th className="px-6 py-5 text-right text-xs font-black text-white uppercase tracking-wider">주문수</th>
                      <th className="px-6 py-5 text-right text-xs font-black text-white uppercase tracking-wider">취소</th>
                      <th className="px-6 py-5 text-right text-xs font-black text-white uppercase tracking-wider">환불</th>
                      <th className="px-6 py-5 text-right text-xs font-black text-white uppercase tracking-wider">순매출</th>
                      <th className="px-6 py-5 text-right text-xs font-black text-white uppercase tracking-wider">배송완료</th>
                      <th className="px-6 py-5 text-right text-xs font-black text-white uppercase tracking-wider">평균주문</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {monthlyData.map((data) => {
                      const netSales = data.totalSales - data.cancelledAmount - data.refundedAmount;
                      return (
                        <tr key={data.month} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all">
                          <td className="px-6 py-5 font-black text-gray-900">{data.month}월</td>
                          <td className="px-6 py-5 text-right font-bold text-blue-700">{formatCurrency(data.totalSales)}</td>
                          <td className="px-6 py-5 text-right font-bold text-gray-700">{data.totalOrders}건</td>
                          <td className="px-6 py-5 text-right">
                            {data.cancelledOrders > 0 ? (
                              <span className="text-red-600 font-bold">
                                {formatCurrency(data.cancelledAmount)} ({data.cancelledOrders}건)
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-5 text-right">
                            {data.refundedOrders > 0 ? (
                              <span className="text-orange-600 font-bold">
                                {formatCurrency(data.refundedAmount)} ({data.refundedOrders}건)
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-5 text-right font-black text-emerald-700">{formatCurrency(netSales)}</td>
                          <td className="px-6 py-5 text-right font-bold text-purple-700">{data.deliveredOrders}건</td>
                          <td className="px-6 py-5 text-right font-bold text-gray-600">{formatCurrency(data.avgOrderValue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Total row */}
                  {summary && (
                    <tfoot>
                      <tr className="bg-gradient-to-r from-indigo-50 to-purple-50 border-t-4 border-indigo-300">
                        <td className="px-6 py-5 font-black text-indigo-900 text-lg">합계</td>
                        <td className="px-6 py-5 text-right font-black text-indigo-900 text-lg">{formatCurrency(summary.totalSales)}</td>
                        <td className="px-6 py-5 text-right font-black text-indigo-900">{summary.totalOrders}건</td>
                        <td className="px-6 py-5 text-right font-black text-red-700">
                          {formatCurrency(summary.cancelledAmount)} ({summary.cancelledOrders}건)
                        </td>
                        <td className="px-6 py-5 text-right font-black text-orange-700">
                          {formatCurrency(summary.refundedAmount)} ({summary.refundedOrders}건)
                        </td>
                        <td className="px-6 py-5 text-right font-black text-emerald-700 text-lg">
                          {formatCurrency(summary.totalSales - summary.cancelledAmount - summary.refundedAmount)}
                        </td>
                        <td className="px-6 py-5 text-right font-black text-purple-700">
                          {monthlyData.reduce((s, d) => s + d.deliveredOrders, 0)}건
                        </td>
                        <td className="px-6 py-5 text-right font-black text-gray-600">
                          {formatCurrency(
                            summary.totalOrders > 0 ? Math.round(summary.totalSales / summary.totalOrders) : 0
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}

        {/* Cancellations Tab */}
        {activeTab === 'cancellations' && (
          <>
            {/* Cancellation Stats */}
            {cancelStats && (
              <div className="grid md:grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-br from-white to-red-50 rounded-3xl shadow-2xl p-6 border-t-4 border-red-500 hover:scale-105 transition-all duration-300">
                  <div className="text-xs font-black text-red-600 uppercase tracking-wider mb-2">❌ 취소 건수</div>
                  <div className="text-4xl font-black text-red-600">{cancelStats.cancelCount}건</div>
                  <div className="text-sm text-gray-500 mt-2 font-semibold">전체 {cancelStats.totalOrderCount}건 중</div>
                </div>
                <div className="bg-gradient-to-br from-white to-orange-50 rounded-3xl shadow-2xl p-6 border-t-4 border-orange-500 hover:scale-105 transition-all duration-300">
                  <div className="text-xs font-black text-orange-600 uppercase tracking-wider mb-2">💸 환불 건수</div>
                  <div className="text-4xl font-black text-orange-600">{cancelStats.refundCount}건</div>
                  <div className="text-sm text-gray-500 mt-2 font-semibold">환불액: {formatCurrency(cancelStats.refundedAmount)}</div>
                </div>
                <div className="bg-gradient-to-br from-white to-rose-50 rounded-3xl shadow-2xl p-6 border-t-4 border-rose-500 hover:scale-105 transition-all duration-300">
                  <div className="text-xs font-black text-rose-600 uppercase tracking-wider mb-2">💰 총 취소/환불 금액</div>
                  <div className="text-3xl font-black text-rose-600">{formatCurrency(cancelStats.totalAmount)}</div>
                </div>
                <div className="bg-gradient-to-br from-white to-amber-50 rounded-3xl shadow-2xl p-6 border-t-4 border-amber-500 hover:scale-105 transition-all duration-300">
                  <div className="text-xs font-black text-amber-600 uppercase tracking-wider mb-2">📉 취소율</div>
                  <div className="text-4xl font-black text-amber-600">{cancelStats.cancellationRate}%</div>
                  <div className="text-sm text-gray-500 mt-2 font-semibold">
                    {cancelStats.totalCancelledRefunded} / {cancelStats.totalOrderCount}건
                  </div>
                </div>
              </div>
            )}

            {/* Cancellation List */}
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
              <div className="px-8 py-6 bg-gradient-to-r from-red-50 to-rose-50 border-b-2 border-red-200">
                <h2 className="text-2xl font-black text-gray-900 flex items-center">
                  <span className="text-3xl mr-3">📋</span>
                  취소/환불 상세 내역
                  {selectedMonth && <span className="ml-2 text-indigo-600">({selectedMonth}월)</span>}
                </h2>
              </div>

              {cancellations.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-8xl mb-6">✅</div>
                  <p className="text-gray-500 font-bold text-xl">취소/환불 내역이 없습니다</p>
                  <p className="text-gray-400 mt-2">해당 기간에 취소 또는 환불된 주문이 없습니다.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-red-800 via-rose-900 to-red-800 border-b-4 border-red-500">
                        <th className="px-6 py-5 text-left text-xs font-black text-white uppercase">주문번호</th>
                        <th className="px-6 py-5 text-left text-xs font-black text-white uppercase">고객</th>
                        <th className="px-6 py-5 text-left text-xs font-black text-white uppercase">상품</th>
                        <th className="px-6 py-5 text-left text-xs font-black text-white uppercase">상태</th>
                        <th className="px-6 py-5 text-right text-xs font-black text-white uppercase">금액</th>
                        <th className="px-6 py-5 text-left text-xs font-black text-white uppercase">사유</th>
                        <th className="px-6 py-5 text-left text-xs font-black text-white uppercase">처리일시</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {cancellations.map((order) => (
                        <tr key={order.id} className="hover:bg-red-50/50 transition-all">
                          <td className="px-6 py-5">
                            <div className="font-mono font-black text-gray-900">{order.orderNumber}</div>
                            <div className="text-xs text-gray-500 mt-1">주문일: {formatDate(order.createdAt)}</div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="font-bold text-gray-900">{order.user?.name || '비회원'}</div>
                            <div className="text-xs text-gray-500">{order.user?.email || '-'}</div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="space-y-1">
                              {order.items.slice(0, 2).map((item, idx) => (
                                <div key={idx} className="text-sm text-gray-700">
                                  {item.product.name} x{item.quantity}
                                </div>
                              ))}
                              {order.items.length > 2 && (
                                <div className="text-xs text-gray-400">외 {order.items.length - 2}건</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className={`px-4 py-2 rounded-xl text-sm font-black shadow-md inline-block ${
                              order.status === 'CANCELLED' 
                                ? 'bg-gradient-to-r from-red-400 to-red-500 text-white' 
                                : 'bg-gradient-to-r from-orange-400 to-orange-500 text-white'
                            }`}>
                              {order.status === 'CANCELLED' ? '❌ 취소' : '💸 환불'}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="font-black text-red-700 text-lg">{formatCurrency(order.total)}</div>
                            {order.refundAmount && (
                              <div className="text-xs text-orange-600 mt-1">환불: {formatCurrency(order.refundAmount)}</div>
                            )}
                          </td>
                          <td className="px-6 py-5">
                            <div className="text-sm text-gray-700 max-w-48 truncate">
                              {order.cancelReason || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-sm text-gray-700 font-medium">
                            {formatDate(order.cancelledAt || order.refundedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {cancelTotalPages > 1 && (
                <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-red-50 border-t-2 border-gray-200 flex items-center justify-between">
                  <div className="text-base text-gray-700 font-bold">
                    페이지 {cancelPage} / {cancelTotalPages}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCancelPage(p => Math.max(1, p - 1))}
                      disabled={cancelPage === 1}
                      className="px-6 py-3 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      ◀ 이전
                    </button>
                    <button
                      onClick={() => setCancelPage(p => Math.min(cancelTotalPages, p + 1))}
                      disabled={cancelPage === cancelTotalPages}
                      className="px-6 py-3 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      다음 ▶
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
