'use client';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  _count?: { products: number };
}

export default function AdminCategoriesPage() {
  const { user, loading: authLoading, logout } = useAdminAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('auth-token');
      const res = await fetch('/api/categories', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setCategories(data.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!form.name.trim()) { setError('카테고리명을 입력하세요'); return; }
    const slug = form.slug.trim() || form.name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '');
    try {
      const token = localStorage.getItem('auth-token');
      const url = editId ? `/api/categories/${editId}` : '/api/categories';
      const res = await fetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, slug }),
      });
      const data = await res.json();
      if (data.success || res.ok) {
        setSuccess(editId ? '수정 완료' : '등록 완료');
        setShowForm(false); setEditId(null);
        setForm({ name: '', slug: '', description: '' });
        fetchCategories();
      } else { setError(data.error || '저장 실패'); }
    } catch (e) { setError('저장 중 오류 발생'); }
  };

  const startEdit = (cat: Category) => {
    setEditId(cat.id);
    setForm({ name: cat.name, slug: cat.slug, description: cat.description || '' });
    setShowForm(true);
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      const token = localStorage.getItem('auth-token');
      await fetch(`/api/categories/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      fetchCategories();
    } catch (e) { console.error(e); }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">카테고리 관리</h1>
        <div className="flex gap-2">
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← 관리자</Link>
          <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', slug: '', description: '' }); }}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
            {showForm ? '취소' : '+ 카테고리 추가'}
          </button>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-4">{success}</p>}

      {showForm && (
        <div className="bg-white border rounded-lg p-4 mb-6 space-y-3">
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="카테고리명" className="w-full border rounded px-3 py-2 text-sm" />
          <input type="text" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}
            placeholder="슬러그 (자동생성)" className="w-full border rounded px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="설명 (선택)" className="w-full border rounded px-3 py-2 text-sm" rows={2} />
          <button onClick={handleSubmit} className="bg-blue-600 text-white px-6 py-2 rounded text-sm hover:bg-blue-700">
            {editId ? '수정' : '등록'}
          </button>
        </div>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>
            <th className="px-4 py-3 text-left">카테고리명</th>
            <th className="px-4 py-3 text-left">슬러그</th>
            <th className="px-4 py-3 text-left">설명</th>
            <th className="px-4 py-3 text-center">관리</th>
          </tr></thead>
          <tbody>
            {categories.map(cat => (
              <tr key={cat.id} className="border-t">
                <td className="px-4 py-3 font-medium">{cat.name}</td>
                <td className="px-4 py-3 text-gray-500">{cat.slug}</td>
                <td className="px-4 py-3 text-gray-500">{cat.description || '-'}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => startEdit(cat)} className="text-blue-600 hover:underline mr-3">수정</button>
                  <button onClick={() => deleteCategory(cat.id)} className="text-red-500 hover:underline">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && <p className="text-center py-8 text-gray-400">등록된 카테고리가 없습니다</p>}
      </div>
    </div>
  );
}
