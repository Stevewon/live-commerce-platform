'use client';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { authFetch } from '@/lib/auth/clientFetch';

interface Notice {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isPublished: boolean;
  createdAt: string;
}

const emptyForm = { title: '', content: '', isPinned: false, isPublished: true };

export default function AdminNoticesPage() {
  const { loading: authLoading } = useAdminAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchNotices(); }, []);

  const fetchNotices = async () => {
    try {
      const res = await authFetch('/api/admin/notices');
      const data = await res.json();
      if (data.success) setNotices(data.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const resetForm = () => { setForm({ ...emptyForm }); setEditId(null); };

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!form.title.trim() || !form.content.trim()) { setError('제목과 내용을 입력하세요'); return; }
    setSaving(true);
    try {
      const url = editId ? `/api/admin/notices/${editId}` : '/api/admin/notices';
      const res = await authFetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(editId ? '수정 완료' : '등록 완료');
        setShowForm(false); resetForm();
        fetchNotices();
      } else { setError(data.error || '저장 실패'); }
    } catch (e) { setError('저장 중 오류 발생'); } finally { setSaving(false); }
  };

  const startEdit = (n: Notice) => {
    setEditId(n.id);
    setForm({ title: n.title, content: n.content, isPinned: n.isPinned, isPublished: n.isPublished });
    setShowForm(true);
    setError(''); setSuccess('');
  };

  const togglePublish = async (n: Notice) => {
    try {
      await authFetch(`/api/admin/notices/${n.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !n.isPublished }),
      });
      fetchNotices();
    } catch (e) { console.error(e); }
  };

  const deleteNotice = async (id: string) => {
    if (!confirm('이 공지사항을 삭제하시겠습니까?')) return;
    try {
      await authFetch(`/api/admin/notices/${id}`, { method: 'DELETE' });
      fetchNotices();
    } catch (e) { console.error(e); }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">📢 공지사항 관리</h1>
        <div className="flex gap-3 items-center">
          <Link href="/notices" target="_blank" className="text-sm text-gray-500 hover:text-gray-700">고객 화면 보기 ↗</Link>
          <button
            onClick={() => { setShowForm(!showForm); resetForm(); setError(''); setSuccess(''); }}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-700"
          >
            {showForm ? '취소' : '+ 공지사항 작성'}
          </button>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-4 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{success}</p>}

      {showForm && (
        <div className="bg-white border rounded-xl p-5 mb-6 space-y-3 shadow-sm">
          <input
            type="text" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="제목"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <textarea
            value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })}
            placeholder="내용 (줄바꿈 그대로 노출됩니다)"
            rows={8}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={form.isPinned}
                onChange={e => setForm({ ...form, isPinned: e.target.checked })}
                className="w-4 h-4 text-purple-600 rounded" />
              <span>📌 상단 고정</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={form.isPublished}
                onChange={e => setForm({ ...form, isPublished: e.target.checked })}
                className="w-4 h-4 text-purple-600 rounded" />
              <span>고객에게 노출(발행)</span>
            </label>
          </div>
          <button onClick={handleSubmit} disabled={saving}
            className="bg-purple-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
            {saving ? '저장 중...' : (editId ? '수정' : '등록')}
          </button>
        </div>
      )}

      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">제목</th>
              <th className="px-4 py-3 text-center w-24">상태</th>
              <th className="px-4 py-3 text-center w-28">작성일</th>
              <th className="px-4 py-3 text-center w-40">관리</th>
            </tr>
          </thead>
          <tbody>
            {notices.map(n => (
              <tr key={n.id} className="border-t">
                <td className="px-4 py-3 font-medium">
                  {n.isPinned && <span className="mr-1">📌</span>}
                  {n.title}
                </td>
                <td className="px-4 py-3 text-center">
                  {n.isPublished
                    ? <span className="inline-block px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">발행</span>
                    : <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold">숨김</span>}
                </td>
                <td className="px-4 py-3 text-center text-gray-500 text-xs">
                  {new Date(n.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <button onClick={() => togglePublish(n)} className="text-gray-600 hover:underline mr-3 text-xs">
                    {n.isPublished ? '숨기기' : '발행'}
                  </button>
                  <button onClick={() => startEdit(n)} className="text-blue-600 hover:underline mr-3 text-xs">수정</button>
                  <button onClick={() => deleteNotice(n.id)} className="text-red-500 hover:underline text-xs">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {notices.length === 0 && <p className="text-center py-10 text-gray-400">등록된 공지사항이 없습니다. 우측 상단에서 작성하세요.</p>}
      </div>
    </div>
  );
}
