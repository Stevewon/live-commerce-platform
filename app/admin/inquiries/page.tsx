'use client';

/**
 * 관리자 - 고객 문의 관리 (목록 + 답변 작성)
 */

import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authFetch } from '@/lib/auth/clientFetch';

interface InquiryRow {
  id: string;
  productId: string | null;
  productName: string | null;
  productSlug: string | null;
  productThumbnail: string | null;
  isMember: boolean;
  authorName: string;
  authorEmail: string | null;
  authorPhone: string | null;
  memberNickname: string | null;
  title: string;
  content: string;
  isSecret: boolean;
  status: 'PENDING' | 'ANSWERED';
  answer: string | null;
  answeredBy: string | null;
  answeredAt: string | null;
  createdAt: string;
}

const STATUS_TABS: Array<{ key: string; label: string }> = [
  { key: 'PENDING', label: '미답변' },
  { key: 'ANSWERED', label: '답변완료' },
  { key: 'ALL', label: '전체' },
];

export default function AdminInquiriesPage() {
  const { user, loading: authLoading, isAdmin } = useAdminAuth();

  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user || !isAdmin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, isAdmin, statusFilter, q]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (q) params.set('q', q);
      params.set('limit', '100');
      const res = await authFetch(`/api/admin/inquiries?${params.toString()}`);
      if (res.ok) {
        const d = await res.json();
        if (d.success) {
          setRows(d.data.items || []);
          setTotal(d.data.total || 0);
          setPendingCount(d.data.pendingCount || 0);
          // 답변 초안 프리필 (기존 답변)
          const drafts: Record<string, string> = {};
          (d.data.items || []).forEach((r: InquiryRow) => {
            drafts[r.id] = r.answer || '';
          });
          setAnswerDraft(drafts);
        }
      }
    } catch (e) {
      console.error('문의 목록 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveAnswer = async (row: InquiryRow) => {
    const answer = (answerDraft[row.id] || '').trim();
    if (!answer) {
      if (!confirm('답변 내용이 비어 있습니다.\n답변을 삭제하고 "미답변" 상태로 되돌리시겠습니까?')) return;
    }
    setSaving(row.id);
    try {
      const res = await authFetch('/api/admin/inquiries', {
        method: 'PATCH',
        body: JSON.stringify({ id: row.id, answer }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || '답변 저장 실패');
      alert(answer ? '답변이 등록되었습니다.' : '답변이 삭제되었습니다.');
      load();
    } catch (e: any) {
      alert(e.message || '답변 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(null);
    }
  };

  const fmtDate = (s: string | null) => {
    if (!s) return '-';
    try {
      return new Date(s).toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return s;
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">인증 확인 중...</div>;
  }
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600">관리자 권한이 필요합니다.</p>
        <Link href="/admin/login" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">관리자 로그인</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">← 대시보드</Link>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
              💬 고객 문의 관리
            </h1>
          </div>
          {pendingCount > 0 && (
            <span className="text-xs sm:text-sm font-semibold text-white bg-red-500 rounded-full px-3 py-1">
              미답변 {pendingCount}건
            </span>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* 필터 + 검색 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="flex gap-2">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${
                  statusFilter === t.key
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {t.label}
                {t.key === 'PENDING' && pendingCount > 0 ? ` (${pendingCount})` : ''}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); setQ(searchInput.trim()); }}
            className="flex-1 flex gap-2"
          >
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="제목·내용·작성자·연락처 검색"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold whitespace-nowrap">검색</button>
            {q && (
              <button type="button" onClick={() => { setQ(''); setSearchInput(''); }} className="px-3 py-2 text-gray-500 text-sm">초기화</button>
            )}
          </form>
        </div>

        <div className="text-sm text-gray-500 mb-3">총 {total.toLocaleString()}건</div>

        {/* 목록 */}
        {loading ? (
          <div className="py-20 text-center text-gray-400">불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-gray-400">문의가 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const isOpen = expanded === row.id;
              return (
                <div key={row.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* 헤더 라인 */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : row.id)}
                    className="w-full text-left px-4 sm:px-5 py-4 flex items-start gap-3 hover:bg-gray-50"
                  >
                    <span className={`mt-0.5 flex-shrink-0 text-xs font-bold px-2 py-1 rounded ${
                      row.status === 'ANSWERED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {row.status === 'ANSWERED' ? '답변완료' : '미답변'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {row.isSecret && <span className="text-xs text-amber-600">🔒 비밀글</span>}
                        <span className="font-semibold text-gray-900 truncate">{row.title}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>{row.authorName}{row.isMember ? ' (회원)' : ' (비회원)'}</span>
                        {row.productName && (
                          <span className="text-indigo-600">🛍️ {row.productName}</span>
                        )}
                        <span>{fmtDate(row.createdAt)}</span>
                      </div>
                    </div>
                    <span className="text-gray-400 text-lg flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {/* 상세 + 답변 */}
                  {isOpen && (
                    <div className="px-4 sm:px-5 pb-5 border-t border-gray-100">
                      {/* 문의 내용 */}
                      <div className="mt-4 bg-gray-50 rounded-lg p-4">
                        <div className="text-xs font-semibold text-gray-400 mb-1">문의 내용</div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{row.content}</p>
                      </div>

                      {/* 연락처 정보 */}
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        {row.memberNickname && <span>닉네임: {row.memberNickname}</span>}
                        {row.authorEmail && <span>이메일: {row.authorEmail}</span>}
                        {row.authorPhone && <span>연락처: {row.authorPhone}</span>}
                        {row.productSlug && (
                          <Link href={`/products/${row.productSlug}`} target="_blank" className="text-indigo-600 underline">상품 보기 ↗</Link>
                        )}
                      </div>

                      {/* 답변 작성 */}
                      <div className="mt-4">
                        <div className="text-xs font-semibold text-gray-500 mb-1">
                          답변 {row.answeredAt ? `(${row.answeredBy || '관리자'} · ${fmtDate(row.answeredAt)})` : ''}
                        </div>
                        <textarea
                          value={answerDraft[row.id] ?? ''}
                          onChange={(e) => setAnswerDraft((prev) => ({ ...prev, [row.id]: e.target.value }))}
                          rows={4}
                          placeholder="고객에게 전달할 답변을 입력하세요."
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            onClick={() => saveAnswer(row)}
                            disabled={saving === row.id}
                            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {saving === row.id ? '저장 중...' : (row.status === 'ANSWERED' ? '답변 수정' : '답변 등록')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
