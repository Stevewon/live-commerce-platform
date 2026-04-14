'use client';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminSettingsPage() {
  const { user, loading: authLoading } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 배송비 설정
  const [shippingFee, setShippingFee] = useState<number>(3000);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number>(50000);

  // 변경 감지
  const [originalShippingFee, setOriginalShippingFee] = useState<number>(3000);
  const [originalFreeShippingThreshold, setOriginalFreeShippingThreshold] = useState<number>(50000);

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/settings/shipping', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setShippingFee(data.data.shippingFee);
          setFreeShippingThreshold(data.data.freeShippingThreshold);
          setOriginalShippingFee(data.data.shippingFee);
          setOriginalFreeShippingThreshold(data.data.freeShippingThreshold);
        }
      }
    } catch (error) {
      console.error('설정 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/admin/settings/shipping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          shippingFee,
          freeShippingThreshold,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '저장 실패');

      alert('배송비 설정이 저장되었습니다.');
      setOriginalShippingFee(shippingFee);
      setOriginalFreeShippingThreshold(freeShippingThreshold);
    } catch (error: any) {
      alert('저장 실패: ' + (error.message || '알 수 없는 오류'));
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    shippingFee !== originalShippingFee ||
    freeShippingThreshold !== originalFreeShippingThreshold;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-purple-200 border-t-purple-600 mx-auto mb-6"></div>
          <p className="text-gray-600 font-bold text-lg">설정을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 shadow-2xl border-b-4 border-blue-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 flex items-center justify-center shadow-2xl">
                <span className="text-3xl">&#9881;</span>
              </div>
              <div>
                <h1 className="text-4xl font-black text-white drop-shadow-lg">
                  사이트 설정
                </h1>
                <p className="mt-2 text-blue-200 text-lg font-medium">Site Settings</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl px-6 py-3 border border-white/20">
                <div className="text-sm text-blue-200 font-medium">관리자</div>
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
              <span className="text-2xl group-hover:scale-110 transition-transform">&#128202;</span>
              <span>대시보드</span>
            </Link>
            <Link href="/admin/users" className="group px-8 py-4 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-bold flex items-center space-x-2 hover:scale-105 duration-200">
              <span className="text-2xl group-hover:scale-110 transition-transform">&#128101;</span>
              <span>회원 관리</span>
            </Link>
            <Link href="/admin/orders" className="group px-8 py-4 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-bold flex items-center space-x-2 hover:scale-105 duration-200">
              <span className="text-2xl group-hover:scale-110 transition-transform">&#128230;</span>
              <span>주문 관리</span>
            </Link>
            <Link href="/admin/products" className="group px-8 py-4 text-gray-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 rounded-xl transition-all font-bold flex items-center space-x-2 hover:scale-105 duration-200">
              <span className="text-2xl group-hover:scale-110 transition-transform">&#128717;</span>
              <span>상품 관리</span>
            </Link>
            <Link href="/admin/settings" className="group px-8 py-4 bg-gradient-to-r from-purple-600 via-purple-700 to-pink-700 text-white rounded-xl shadow-xl font-bold flex items-center space-x-2 ring-4 ring-purple-200 scale-105">
              <span className="text-2xl">&#9881;</span>
              <span>설정</span>
            </Link>
          </div>
        </div>

        {/* 배송비 설정 섹션 */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200 mb-8">
          <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-blue-50 border-b-2 border-gray-200">
            <h2 className="text-2xl font-black text-gray-900 flex items-center">
              <span className="text-3xl mr-3">&#128666;</span>
              배송비 설정
            </h2>
            <p className="text-gray-500 mt-1 font-medium">배송비와 무료배송 기준금액을 설정합니다. 변경하면 즉시 사이트 전체에 적용됩니다.</p>
          </div>

          <div className="p-8 space-y-8">
            {/* 기본 배송비 */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-200">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
                  <span className="text-2xl text-white">&#128176;</span>
                </div>
                <div className="flex-1">
                  <label className="block text-lg font-black text-gray-900 mb-1">기본 배송비</label>
                  <p className="text-sm text-gray-500 mb-4 font-medium">무료배송 조건을 충족하지 않는 주문에 부과되는 배송비입니다.</p>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-xs">
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={shippingFee}
                        onChange={(e) => setShippingFee(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full pl-6 pr-12 py-4 text-xl font-black border-3 border-blue-300 rounded-xl focus:ring-4 focus:ring-blue-200 focus:border-blue-500 bg-white shadow-inner"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">원</span>
                    </div>
                    <div className="flex gap-2">
                      {[0, 2500, 3000, 3500, 5000].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setShippingFee(preset)}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            shippingFee === preset
                              ? 'bg-blue-600 text-white shadow-lg'
                              : 'bg-white text-gray-600 border border-gray-300 hover:bg-blue-50 hover:border-blue-400'
                          }`}
                        >
                          {preset === 0 ? '무료' : `${preset.toLocaleString()}원`}
                        </button>
                      ))}
                    </div>
                  </div>
                  {shippingFee === 0 && (
                    <p className="mt-3 text-sm text-green-600 font-bold flex items-center gap-1">
                      <span>&#9989;</span> 모든 주문 무료배송으로 설정됩니다
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 무료배송 기준금액 */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg flex-shrink-0">
                  <span className="text-2xl text-white">&#127873;</span>
                </div>
                <div className="flex-1">
                  <label className="block text-lg font-black text-gray-900 mb-1">무료배송 기준금액</label>
                  <p className="text-sm text-gray-500 mb-4 font-medium">이 금액 이상 주문 시 배송비가 무료로 적용됩니다. 0으로 설정하면 항상 배송비가 부과됩니다.</p>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-xs">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={freeShippingThreshold}
                        onChange={(e) => setFreeShippingThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full pl-6 pr-12 py-4 text-xl font-black border-3 border-green-300 rounded-xl focus:ring-4 focus:ring-green-200 focus:border-green-500 bg-white shadow-inner"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">원</span>
                    </div>
                    <div className="flex gap-2">
                      {[0, 30000, 50000, 70000, 100000].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setFreeShippingThreshold(preset)}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            freeShippingThreshold === preset
                              ? 'bg-green-600 text-white shadow-lg'
                              : 'bg-white text-gray-600 border border-gray-300 hover:bg-green-50 hover:border-green-400'
                          }`}
                        >
                          {preset === 0 ? '없음' : `${(preset / 10000).toLocaleString()}만원`}
                        </button>
                      ))}
                    </div>
                  </div>
                  {freeShippingThreshold === 0 && shippingFee > 0 && (
                    <p className="mt-3 text-sm text-orange-600 font-bold flex items-center gap-1">
                      <span>&#9888;</span> 무료배송 기준이 없으므로 모든 주문에 배송비가 부과됩니다
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 미리보기 */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200">
              <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center">
                <span className="text-2xl mr-2">&#128065;</span>
                적용 미리보기
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-5 text-center shadow-sm border border-purple-100">
                  <p className="text-sm text-gray-500 mb-1 font-medium">10,000원 주문 시</p>
                  <p className="text-2xl font-black text-gray-900">
                    {freeShippingThreshold > 0 && 10000 >= freeShippingThreshold
                      ? '무료'
                      : `+${shippingFee.toLocaleString()}원`}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    총 {(10000 + (freeShippingThreshold > 0 && 10000 >= freeShippingThreshold ? 0 : shippingFee)).toLocaleString()}원
                  </p>
                </div>
                <div className="bg-white rounded-xl p-5 text-center shadow-sm border border-purple-100">
                  <p className="text-sm text-gray-500 mb-1 font-medium">
                    {freeShippingThreshold > 0 ? `${freeShippingThreshold.toLocaleString()}원 주문 시` : '50,000원 주문 시'}
                  </p>
                  <p className="text-2xl font-black text-green-600">
                    {freeShippingThreshold > 0 ? '무료' : `+${shippingFee.toLocaleString()}원`}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    총 {((freeShippingThreshold > 0 ? freeShippingThreshold : 50000) + (freeShippingThreshold > 0 ? 0 : shippingFee)).toLocaleString()}원
                  </p>
                </div>
                <div className="bg-white rounded-xl p-5 text-center shadow-sm border border-purple-100">
                  <p className="text-sm text-gray-500 mb-1 font-medium">100,000원 주문 시</p>
                  <p className="text-2xl font-black text-green-600">
                    {freeShippingThreshold > 0 && 100000 >= freeShippingThreshold
                      ? '무료'
                      : `+${shippingFee.toLocaleString()}원`}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    총 {(100000 + (freeShippingThreshold > 0 && 100000 >= freeShippingThreshold ? 0 : shippingFee)).toLocaleString()}원
                  </p>
                </div>
              </div>
            </div>

            {/* 현재 표시 문구 미리보기 */}
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-6 border-2 border-amber-200">
              <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center">
                <span className="text-2xl mr-2">&#128172;</span>
                고객에게 표시되는 문구
              </h3>
              <div className="space-y-3">
                <div className="bg-white rounded-xl p-4 border border-amber-100">
                  <p className="text-sm text-gray-600 font-medium">상품 페이지:</p>
                  <p className="text-base font-bold text-gray-900 mt-1">
                    {shippingFee === 0
                      ? '전 상품 무료배송'
                      : freeShippingThreshold > 0
                        ? `배송비 ${shippingFee.toLocaleString()}원 (${(freeShippingThreshold / 10000).toLocaleString()}만원 이상 무료배송)`
                        : `배송비 ${shippingFee.toLocaleString()}원`}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-amber-100">
                  <p className="text-sm text-gray-600 font-medium">장바구니 (금액 부족 시):</p>
                  <p className="text-base font-bold text-blue-600 mt-1">
                    {freeShippingThreshold > 0 && shippingFee > 0
                      ? `XX원 더 담으면 무료배송!`
                      : shippingFee === 0
                        ? '무료배송 적용 중'
                        : '배송비가 부과됩니다'}
                  </p>
                </div>
              </div>
            </div>

            {/* 저장 버튼 */}
            <div className="flex items-center justify-between pt-4 border-t-2 border-gray-200">
              <div>
                {hasChanges && (
                  <span className="inline-flex items-center gap-1 text-amber-600 font-bold text-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    변경사항이 있습니다
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShippingFee(originalShippingFee);
                    setFreeShippingThreshold(originalFreeShippingThreshold);
                  }}
                  disabled={!hasChanges || saving}
                  className="px-8 py-4 bg-gray-200 text-gray-700 rounded-2xl font-black hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  초기화
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-black hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>저장 중...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xl">&#128190;</span>
                      <span>설정 저장</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
