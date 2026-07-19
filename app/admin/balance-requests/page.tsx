'use client';

/**
 * [v1.0.22] 관리자 - 충전 신청 승인/거부 화면
 */

import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authFetch } from '@/lib/auth/clientFetch';

interface RequestRow {
  id: string;
  userId: string;
  type: 'KRW_DEPOSIT' | 'QKEY_DEPOSIT';
  amount: number;
  depositorName: string | null;
  txHash: string | null;
  senderAddress: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNote: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  userEmail: string | null;
  userNickname: string | null;
  userName: string | null;
  userPhone: string | null;
}

interface Summary {
  PENDING: number;
  APPROVED: number;
  REJECTED: number;
}

const STATUS_TABS: Array<{ key: string; label: string }> = [
  { key: 'PENDING', label: '승인 대기' },
  { key: 'APPROVED', label: '승인 완료' },
  { key: 'REJECTED', label: '거부' },
  { key: 'ALL', label: '전체' },
];

export default function AdminBalanceRequestsPage() {
  const { user, loading: authLoading, isAdmin } = useAdminAuth();

  const [rows, setRows] = useState<RequestRow[]>([]);
  const [summary, setSummary] = useState<Summary>({ PENDING: 0, APPROVED: 0, REJECTED: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user || !isAdmin) return;
    load();
  }, [user, authLoading, isAdmin, statusFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const qs = statusFilter === 'ALL' ? '' : `?status=${statusFilter}`;
      const res = await authFetch(`/api/admin/balance-requests${qs}`);
      if (res.ok) {
        const d = await res.json();
        if (d.success) {
          setRows(d.data || []);
          if (d.summary) setSummary(d.summary);
        }
      }
    } catch (e) {
      console.error('충전 신청 목록 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  const approve = async (row: RequestRow) => {
    const label = row.type === 'KRW_DEPOSIT'
      ? `KRW ₩${row.amount.toLocaleString()}`
      : `QKEY ${row.amount.toLocaleString()}`;
    if (!confirm(`${row.userName || row.userEmail || row.userId}\n${label} 충전을 승인하시겠습니까?\n승인 시 즉시 잔액이 반영됩니다.`)) return;
    setProcessing(row.id);
    try {
      const res = await authFetch(`/api/admin/balance-requests/${row.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || '승인 실패');
      alert(d.message || '승인되었습니다.');
      load();
    } catch (e: any) {
      alert(e.message || '승인 처리 중 오류');
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (row: RequestRow) => {
    const note = prompt('거부 사유를 입력해주세요 (사용자에게 표시됩니다):', '');
    if (note === null) return;
    setProcessing(row.id);
    try {
      const res = await authFetch(`/api/admin/balance-requests/${row.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ adminNote: note }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || '거부 실패');
      alert(d.message || '거부되었습니다.');
      load();
    } catch (e: any) {
      alert(e.message || '거부 처리 중 오류');
    } finally {
      setProcessing(null);
    }
  };

  const fmtDate = (s: string | null) => {
    if (!s) return '-';
    try {
      return new Date(s).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' } as any);
    } catch {
      return s;
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      PENDING: 'text-yellow-700 bg-yellow-100',
      APPROVED: 'text-green-700 bg-green-100',
      REJECTED: 'text-red-700 bg-red-100',
    };
    const label: Record<string, string> = {
      PENDING: '승인 대기',
      APPROVED: '승인 완료',
      REJECTED: '거부됨',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${map[status] || 'text-gray-700 bg-gray-100'}`}>
        {label[status] || status}
      </span>
    );
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-4 flex items-center gap-2 text-sm">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600">← 관리자</Link>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">💳 충전 신청 관리</h1>

        {/* 요약 */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
            <div className="text-xs text-gray-500 mb-1">승인 대기</div>
            <div className="text-2xl font-bold text-yellow-600">{summary.PENDING}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
            <div className="text-xs text-gray-500 mb-1">승인 완료</div>
            <div className="text-2xl font-bold text-green-600">{summary.APPROVED}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
            <div className="text-xs text-gray-500 mb-1">거부</div>
            <div className="text-2xl font-bold text-red-500">{summary.REJECTED}</div>
          </div>
        </div>

        {/* 필터 탭 */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition ${statusFilter === t.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 목록 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-gray-400">불러오는 중...</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">신청 내역이 없습니다.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map((row) => (
                <li key={row.id} className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${row.type === 'KRW_DEPOSIT' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          {row.type === 'KRW_DEPOSIT' ? 'KRW' : 'QKEY'}
                        </span>
                        <span className="text-lg font-bold text-gray-900">
                          {row.type === 'KRW_DEPOSIT'
                            ? `₩${row.amount.toLocaleString()}`
                            : `${row.amount.toLocaleString()} QKEY`}
                        </span>
                        {statusBadge(row.status)}
                      </div>
                      <div className="text-sm text-gray-700">
                        {row.userName || row.userNickname || '이름없음'}{' '}
                        <span className="text-gray-400">
                          ({row.userEmail || row.userPhone || row.userId.slice(0, 8)})
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1 break-all">
                        {row.type === 'KRW_DEPOSIT' && row.depositorName && <>입금자: <b className="text-gray-600">{row.depositorName}</b> · </>}
                        {row.type === 'QKEY_DEPOSIT' && row.txHash && <>TX: {row.txHash} · </>}
                        신청 {fmtDate(row.createdAt)}
                      </div>
                      {row.type === 'QKEY_DEPOSIT' && row.senderAddress && (
                        <div className="text-xs text-gray-400 break-all">보낸주소: {row.senderAddress}</div>
                      )}
                      {row.status === 'REJECTED' && row.adminNote && (
                        <div className="text-xs text-red-500 mt-1">거부 사유: {row.adminNote}</div>
                      )}
                    </div>

                    {row.status === 'PENDING' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => approve(row)}
                          disabled={processing === row.id}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:bg-gray-400 transition"
                        >
                          {processing === row.id ? '처리중...' : '승인'}
                        </button>
                        <button
                          onClick={() => reject(row)}
                          disabled={processing === row.id}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 disabled:bg-gray-400 transition"
                        >
                          거부
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
