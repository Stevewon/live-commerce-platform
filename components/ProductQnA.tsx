'use client';

/**
 * 상품 상세 - 고객 Q&A (문의 작성 + 목록)
 * - 회원: 로그인 정보로 자동 작성
 * - 비회원: 이름/연락처 직접 입력
 * - 비밀글 지원 (작성자/관리자만 열람)
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { authFetch } from '@/lib/auth/clientFetch';

interface QnAItem {
  id: string;
  authorName: string;
  title: string;
  content: string;
  isSecret: boolean;
  locked: boolean;
  status: 'PENDING' | 'ANSWERED';
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
  isMine: boolean;
}

export default function ProductQnA({ productId }: { productId: string }) {
  const { user } = useAuth();

  const [items, setItems] = useState<QnAItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // 폼 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSecret, setIsSecret] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 로그인 상태면 authFetch(비밀글 본인글 열람), 아니면 일반 fetch
      const fetcher = user ? authFetch : fetch;
      const res = await fetcher(`/api/inquiries?productId=${productId}&limit=50`);
      if (res.ok) {
        const d = await res.json();
        if (d.success) setItems(d.data.items || []);
      }
    } catch (e) {
      console.error('Q&A 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [productId, user]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert('제목을 입력해주세요.');
    if (!content.trim()) return alert('문의 내용을 입력해주세요.');
    if (!user && !guestName.trim()) return alert('작성자 이름을 입력해주세요.');

    setSubmitting(true);
    try {
      const payload: any = { productId, title: title.trim(), content: content.trim(), isSecret };
      if (!user) {
        payload.authorName = guestName.trim();
        payload.authorPhone = guestPhone.trim();
      }
      const fetcher = user ? authFetch : fetch;
      const res = await fetcher('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || '문의 등록 실패');
      alert('문의가 등록되었습니다. 답변이 등록되면 확인하실 수 있습니다.');
      setTitle(''); setContent(''); setIsSecret(false); setGuestName(''); setGuestPhone('');
      setShowForm(false);
      load();
    } catch (err: any) {
      alert(err.message || '문의 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch { return s; }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">상품 Q&A</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
        >
          {showForm ? '작성 취소' : '문의하기'}
        </button>
      </div>

      {/* 작성 폼 */}
      {showForm && (
        <form onSubmit={submit} className="bg-gray-50 rounded-xl p-4 sm:p-5 space-y-3 border border-gray-200">
          {!user && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
                placeholder="이름 *"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="연락처 (선택)"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
          <input
            type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="제목 *"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <textarea
            value={content} onChange={(e) => setContent(e.target.value)}
            rows={4} placeholder="문의 내용을 입력해주세요. *"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={isSecret} onChange={(e) => setIsSecret(e.target.checked)} className="w-4 h-4 rounded" />
              🔒 비밀글 (작성자와 관리자만 볼 수 있어요)
            </label>
            <button type="submit" disabled={submitting}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? '등록 중...' : '문의 등록'}
            </button>
          </div>
        </form>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="py-12 text-center text-gray-400">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <span className="text-5xl block mb-4">💬</span>
          <p className="text-lg font-medium text-gray-500 mb-1">등록된 문의가 없습니다</p>
          <p className="text-sm">상품에 대한 궁금한 점을 남겨주세요.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {items.map((it) => {
            const isOpen = expanded === it.id;
            return (
              <div key={it.id} className="py-4">
                <button
                  onClick={() => !it.locked && setExpanded(isOpen ? null : it.id)}
                  className={`w-full text-left flex items-start gap-3 ${it.locked ? 'cursor-default' : 'hover:opacity-80'}`}
                >
                  <span className={`mt-0.5 flex-shrink-0 text-xs font-bold px-2 py-1 rounded ${
                    it.status === 'ANSWERED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {it.status === 'ANSWERED' ? '답변완료' : '답변대기'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {it.isSecret && <span className="text-xs text-amber-600">🔒</span>}
                      <span className="font-semibold text-gray-900 truncate">{it.title}</span>
                      {it.isMine && <span className="text-[10px] text-indigo-500 border border-indigo-200 rounded px-1">내 문의</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {it.authorName} · {fmtDate(it.createdAt)}
                    </div>
                  </div>
                  {!it.locked && <span className="text-gray-300 flex-shrink-0">{isOpen ? '▲' : '▼'}</span>}
                </button>

                {isOpen && !it.locked && (
                  <div className="mt-3 ml-1 space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap break-words">
                      {it.content}
                    </div>
                    {it.answer ? (
                      <div className="bg-indigo-50 rounded-lg p-3 border-l-4 border-indigo-400">
                        <div className="text-xs font-semibold text-indigo-600 mb-1">
                          ↳ 판매자 답변 {it.answeredAt ? `· ${fmtDate(it.answeredAt)}` : ''}
                        </div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{it.answer}</p>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 pl-1">아직 답변이 등록되지 않았습니다.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
