'use client';

/**
 * 관리자 - 상품 리뷰 관리
 * - 전체 리뷰 목록 조회 (검색/별점/신고 필터 + 페이지네이션)
 * - 통계 카드 (총 리뷰수 / 평균 별점 / 신고 리뷰수)
 * - 부적절 리뷰 삭제, 신고 처리 토글
 */

import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { authFetch } from '@/lib/auth/clientFetch';
import { thumbUrl } from '@/lib/utils/imgProxy';

interface ReviewRow {
  id: string;
  rating: number;
  content: string;
  isReported: boolean;
  createdAt: string;
  user?: { id: string; name: string | null; email: string | null } | null;
  product?: { id: string; name: string; slug: string; thumbnail: string | null } | null;
  order?: { id: string; orderNumber: string } | null;
}

interface Stats {
  count: number;
  averageRating: number;
  reportedCount: number;
}

const RATING_TABS = [
  { key: 'ALL', label: '전체' },
  { key: '5', label: '⭐5' },
  { key: '4', label: '⭐4' },
  { key: '3', label: '⭐3' },
  { key: '2', label: '⭐2' },
  { key: '1', label: '⭐1' },
];

function stars(n: number) {
  const full = Math.max(0, Math.min(5, Math.round(n)));
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

export default function AdminReviewsPage() {
  const { user, loading: authLoading, isAdmin } = useAdminAuth();

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [stats, setStats] = useState<Stats>({ count: 0, averageRating: 0, reportedCount: 0 });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState('ALL');
  const [reportedOnly, setReportedOnly] = useState(false);
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (ratingFilter !== 'ALL') params.set('rating', ratingFilter);
      if (reportedOnly) params.set('reported', 'true');
      if (q) params.set('search', q);
      params.set('page', String(page));
      params.set('limit', '20');
      const res = await authFetch(`/api/admin/reviews?${params.toString()}`);
      const d = await res.json();
      if (d.success) {
        setRows(d.data || []);
        setStats(d.stats || { count: 0, averageRating: 0, reportedCount: 0 });
        setTotal(d.pagination?.total || 0);
        setTotalPages(d.pagination?.totalPages || 1);
      }
    } catch (e) {
      console.error('리뷰 목록 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [ratingFilter, reportedOnly, q, page]);

  useEffect(() => {
    if (authLoading || !user || !isAdmin) return;
    load();
  }, [user, authLoading, isAdmin, load]);

  // 필터 변경 시 1페이지로
  useEffect(() => {
    setPage(1);
  }, [ratingFilter, reportedOnly, q]);

  const handleDelete = async (id: string) => {
    if (!confirm('이 리뷰를 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.')) return;
    setBusy(id);
    try {
      const res = await authFetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.success) {
        load();
      } else {
        alert(d.error || '삭제에 실패했습니다');
      }
    } catch {
      alert('삭제 중 오류가 발생했습니다');
    } finally {
      setBusy(null);
    }
  };

  const handleToggleReport = async (id: string, next: boolean) => {
    setBusy(id);
    try {
      const res = await authFetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isReported: next }),
      });
      const d = await res.json();
      if (d.success) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isReported: next } : r)));
      } else {
        alert(d.error || '처리에 실패했습니다');
      }
    } catch {
      alert('처리 중 오류가 발생했습니다');
    } finally {
      setBusy(null);
    }
  };

  const fmtDate = (s: string) => {
    try {
      return new Date(s).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return s;
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">인증 확인 중...</div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600">관리자 권한이 필요합니다.</p>
        <Link href="/admin/login" className="text-blue-600 hover:underline">로그인</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">상품 리뷰 관리</h1>
        <p className="text-sm text-gray-500 mt-1">고객이 작성한 상품 리뷰를 조회하고 부적절한 리뷰를 관리합니다.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <div className="text-sm text-gray-500">총 리뷰</div>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 mt-1">{stats.count.toLocaleString()}<span className="text-base font-medium text-gray-400 ml-1">개</span></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <div className="text-sm text-gray-500">평균 별점</div>
          <div className="text-2xl sm:text-3xl font-black text-purple-600 mt-1">{stats.averageRating.toFixed(1)}<span className="text-yellow-500 text-base ml-2">{stars(stats.averageRating)}</span></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <div className="text-sm text-gray-500">신고된 리뷰</div>
          <div className="text-2xl sm:text-3xl font-black text-red-500 mt-1">{stats.reportedCount.toLocaleString()}<span className="text-base font-medium text-gray-400 ml-1">개</span></div>
        </div>
      </div>

      {/* 필터/검색 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {RATING_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setRatingFilter(t.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                ratingFilter === t.key ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={reportedOnly} onChange={(e) => setReportedOnly(e.target.checked)} className="w-4 h-4 accent-red-500" />
            신고된 리뷰만
          </label>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setQ(searchInput.trim()); }}
          className="flex gap-2"
        >
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="상품명 / 작성자 / 리뷰 내용 검색"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button type="submit" className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition whitespace-nowrap">검색</button>
        </form>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">불러오는 중...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <span className="text-4xl block mb-3">📭</span>
          조건에 맞는 리뷰가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-gray-500">총 {total.toLocaleString()}개</div>
          {rows.map((r) => (
            <div
              key={r.id}
              className={`bg-white rounded-xl border p-4 shadow-sm ${r.isReported ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200'}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* 상품 썸네일 */}
                <Link href={r.product?.slug ? `/products/${r.product.slug}` : '#'} className="flex items-center gap-3 sm:w-56 flex-shrink-0">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {r.product?.thumbnail ? (
                      <img src={thumbUrl(r.product.thumbnail, 200)} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{r.product?.name || '삭제된 상품'}</div>
                    <div className="text-xs text-gray-400 truncate">{r.order?.orderNumber || ''}</div>
                  </div>
                </Link>

                {/* 리뷰 본문 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-yellow-500 text-sm">{stars(r.rating)}</span>
                    <span className="text-xs font-semibold text-gray-700">{r.rating}.0</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">{r.user?.name || '익명'}</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-400">{fmtDate(r.createdAt)}</span>
                    {r.isReported && (
                      <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">🚩 신고됨</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{r.content}</p>
                </div>

                {/* 액션 */}
                <div className="flex sm:flex-col gap-2 sm:w-28 flex-shrink-0">
                  <button
                    onClick={() => handleToggleReport(r.id, !r.isReported)}
                    disabled={busy === r.id}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition disabled:opacity-50 ${
                      r.isReported
                        ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                        : 'border-amber-300 text-amber-600 hover:bg-amber-50'
                    }`}
                  >
                    {r.isReported ? '신고 해제' : '신고 표시'}
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={busy === r.id}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-300 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50 transition"
              >
                이전
              </button>
              <span className="text-sm text-gray-600 px-2">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50 transition"
              >
                다음
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
