'use client';

/**
 * 관리자 - 일본 해외배송비 관리
 * - 47개 도도부현별 배송비를 원(KRW)으로 입력. 엔(JPY) 환산액을 실시간 미리보기.
 * - 환율(1원 = ? 엔) / 미설정 현 기본배송비 설정.
 */

import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { authFetch } from '@/lib/auth/clientFetch';

interface PrefRow {
  code: string;
  ko: string;
  ja: string;
  region: string;
  feeKrw: number;
  feeJpy: number;
  isActive: boolean;
  configured: boolean;
}

export default function AdminJapanShippingPage() {
  const { user, loading: authLoading, isAdmin } = useAdminAuth();

  const [rows, setRows] = useState<PrefRow[]>([]);
  const [rate, setRate] = useState<number>(0.11);
  const [defaultFee, setDefaultFee] = useState<number>(15000);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/japan-shipping');
      const json = await res.json();
      if (json.success) {
        setRows(json.data.prefectures);
        setRate(json.data.rate);
        setDefaultFee(json.data.defaultFeeKrw);
      }
    } catch (e) {
      setMsg('불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const jpy = (krw: number) => (krw > 0 ? Math.ceil(krw * rate) : 0);

  const setFee = (code: string, value: string) => {
    const v = Math.max(0, Math.floor(Number(value) || 0));
    setRows((prev) => prev.map((r) => (r.code === code ? { ...r, feeKrw: v } : r)));
  };
  const toggleActive = (code: string) => {
    setRows((prev) => prev.map((r) => (r.code === code ? { ...r, isActive: !r.isActive } : r)));
  };

  const groups = useMemo(() => {
    const g: Record<string, PrefRow[]> = {};
    for (const r of rows) {
      (g[r.region] ||= []).push(r);
    }
    return g;
  }, [rows]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await authFetch('/api/admin/japan-shipping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rate,
          defaultFeeKrw: defaultFee,
          fees: rows.map((r) => ({ code: r.code, feeKrw: r.feeKrw, isActive: r.isActive })),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMsg(`저장되었습니다. (${json.data.updated}개 지역)`);
        load();
      } else {
        setMsg(json.error || '저장에 실패했습니다.');
      }
    } catch (e) {
      setMsg('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">로딩 중...</div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-gray-600">관리자 전용 페이지입니다.</p>
        <Link href="/admin/dashboard" className="text-indigo-600 underline">대시보드로 이동</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🚢 일본 해외배송비 관리</h1>
            <p className="text-sm text-gray-500 mt-1">
              배송비는 <b>원(KRW)</b>으로 입력하면 일본 고객에게 <b>엔(JPY)</b>으로 자동 환산되어 표시됩니다.
              국내 배송은 무료 정책이 유지됩니다.
            </p>
          </div>
          <Link href="/admin/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← 대시보드</Link>
        </div>

        {/* 환율 / 기본 배송비 설정 */}
        <div className="bg-white rounded-xl shadow-sm border p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">환율 (1원 = ? 엔)</label>
            <div className="flex items-center gap-2">
              <input
                type="number" step="0.0001" min="0"
                value={rate}
                onChange={(e) => setRate(Math.max(0, Number(e.target.value) || 0))}
                className="w-40 border rounded-lg px-3 py-2"
              />
              <span className="text-sm text-gray-500">1,000원 ≈ {Math.ceil(1000 * rate).toLocaleString()}엔</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">예: 0.11 → 1원당 0.11엔 (100엔 ≈ 909원)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">기본 배송비 (미설정 지역, 원)</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0"
                value={defaultFee}
                onChange={(e) => setDefaultFee(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                className="w-40 border rounded-lg px-3 py-2"
              />
              <span className="text-sm text-gray-500">≈ {jpy(defaultFee).toLocaleString()}엔</span>
            </div>
          </div>
        </div>

        {msg && (
          <div className="mb-4 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-2 text-sm">
            {msg}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-500 py-16">불러오는 중...</div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groups).map(([region, list]) => (
              <div key={region} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">{region} 지방</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="px-4 py-2 font-medium">지역 (한국어 / 日本語)</th>
                      <th className="px-4 py-2 font-medium">배송비 (원)</th>
                      <th className="px-4 py-2 font-medium">엔화 환산</th>
                      <th className="px-4 py-2 font-medium text-center">배송 가능</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.code} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <span className="font-medium text-gray-900">{r.ko}</span>
                          <span className="text-gray-400 ml-2">{r.ja}</span>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number" min="0"
                            value={r.feeKrw}
                            onChange={(e) => setFee(r.code, e.target.value)}
                            className="w-32 border rounded-lg px-2 py-1"
                          />
                        </td>
                        <td className="px-4 py-2 text-gray-600">
                          {jpy(r.feeKrw).toLocaleString()} 엔
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => toggleActive(r.code)}
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                            }`}
                          >
                            {r.isActive ? '가능' : '불가'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        <div className="sticky bottom-4 mt-6 flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold shadow-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '전체 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
