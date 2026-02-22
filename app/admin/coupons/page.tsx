'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: 'FIXED' | 'PERCENT' | 'FREE_SHIPPING';
  value: number;
  minAmount: number | null;
  maxDiscount: number | null;
  validFrom: string;
  validUntil: string;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  _count?: {
    orders: number;
  };
}

export default function AdminCouponsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // 새 쿠폰 폼 데이터
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    type: 'FIXED' as 'FIXED' | 'PERCENT' | 'FREE_SHIPPING',
    value: '',
    minAmount: '',
    maxDiscount: '',
    validFrom: '',
    validUntil: '',
    usageLimit: '',
    isActive: true,
  });

  // 인증 확인
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // 쿠폰 목록 불러오기
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchCoupons();
    }
  }, [user, statusFilter, searchTerm]);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        status: statusFilter,
        ...(searchTerm && { search: searchTerm }),
      });

      const response = await fetch(`/api/admin/coupons?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setCoupons(data.data.coupons);
      } else {
        setError(data.error || '쿠폰 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('쿠폰 목록 조회 오류:', error);
      setError('쿠폰 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 쿠폰 생성/수정
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      const url = editingCoupon
        ? `/api/admin/coupons/${editingCoupon.id}`
        : '/api/admin/coupons';
      const method = editingCoupon ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        alert(data.message);
        setShowCreateModal(false);
        setEditingCoupon(null);
        resetForm();
        fetchCoupons();
      } else {
        alert(data.error || '쿠폰 처리에 실패했습니다.');
      }
    } catch (error) {
      console.error('쿠폰 처리 오류:', error);
      alert('쿠폰 처리에 실패했습니다.');
    }
  };

  // 쿠폰 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('정말 이 쿠폰을 삭제하시겠습니까?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/coupons/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        alert(data.message);
        fetchCoupons();
      } else {
        alert(data.error || '쿠폰 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('쿠폰 삭제 오류:', error);
      alert('쿠폰 삭제에 실패했습니다.');
    }
  };

  // 쿠폰 활성화/비활성화 토글
  const handleToggleActive = async (coupon: Coupon) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !coupon.isActive }),
      });

      const data = await response.json();

      if (data.success) {
        fetchCoupons();
      } else {
        alert(data.error || '쿠폰 상태 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('쿠폰 상태 변경 오류:', error);
      alert('쿠폰 상태 변경에 실패했습니다.');
    }
  };

  // 수정 모달 열기
  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      name: coupon.name,
      description: coupon.description || '',
      type: coupon.type,
      value: coupon.value.toString(),
      minAmount: coupon.minAmount?.toString() || '',
      maxDiscount: coupon.maxDiscount?.toString() || '',
      validFrom: coupon.validFrom.split('T')[0],
      validUntil: coupon.validUntil.split('T')[0],
      usageLimit: coupon.usageLimit?.toString() || '',
      isActive: coupon.isActive,
    });
    setShowCreateModal(true);
  };

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      type: 'FIXED',
      value: '',
      minAmount: '',
      maxDiscount: '',
      validFrom: '',
      validUntil: '',
      usageLimit: '',
      isActive: true,
    });
  };

  // 쿠폰 상태 표시
  const getCouponStatus = (coupon: Coupon) => {
    const now = new Date();
    const validFrom = new Date(coupon.validFrom);
    const validUntil = new Date(coupon.validUntil);

    if (!coupon.isActive) {
      return { label: '비활성', color: 'bg-gray-100 text-gray-600' };
    }
    if (now < validFrom) {
      return { label: '대기중', color: 'bg-yellow-100 text-yellow-600' };
    }
    if (now > validUntil) {
      return { label: '만료됨', color: 'bg-red-100 text-red-600' };
    }
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return { label: '소진됨', color: 'bg-orange-100 text-orange-600' };
    }
    return { label: '활성', color: 'bg-green-100 text-green-600' };
  };

  // 할인 값 포맷팅
  const formatDiscountValue = (coupon: Coupon) => {
    if (coupon.type === 'FIXED') {
      return `₩${coupon.value.toLocaleString()}`;
    } else if (coupon.type === 'PERCENT') {
      return `${coupon.value}%`;
    } else {
      return '무료배송';
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">쿠폰 관리</h1>
          <p className="mt-2 text-sm text-gray-600">
            할인 쿠폰을 생성하고 관리하세요
          </p>
        </div>

        {/* 필터 및 검색 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            {/* 상태 필터 */}
            <div className="flex gap-2">
              {['all', 'active', 'inactive', 'expired'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all'
                    ? '전체'
                    : status === 'active'
                    ? '활성'
                    : status === 'inactive'
                    ? '비활성'
                    : '만료'}
                </button>
              ))}
            </div>

            {/* 검색 및 생성 버튼 */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="쿠폰 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={() => {
                  resetForm();
                  setEditingCoupon(null);
                  setShowCreateModal(true);
                }}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-medium"
              >
                + 쿠폰 생성
              </button>
            </div>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">⚠️ {error}</p>
          </div>
        )}

        {/* 쿠폰 목록 */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : coupons.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500">등록된 쿠폰이 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    쿠폰 코드
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    쿠폰명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    할인
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    유효기간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사용현황
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {coupons.map((coupon) => {
                  const status = getCouponStatus(coupon);
                  return (
                    <tr key={coupon.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm font-bold text-purple-600">
                          {coupon.code}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {coupon.name}
                          </div>
                          {coupon.description && (
                            <div className="text-sm text-gray-500">
                              {coupon.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDiscountValue(coupon)}
                        </div>
                        {coupon.minAmount && (
                          <div className="text-xs text-gray-500">
                            최소 ₩{coupon.minAmount.toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(coupon.validFrom).toLocaleDateString('ko-KR')}
                        </div>
                        <div className="text-sm text-gray-500">
                          ~ {new Date(coupon.validUntil).toLocaleDateString('ko-KR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {coupon.usedCount}
                          {coupon.usageLimit && ` / ${coupon.usageLimit}`}회
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(coupon)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleToggleActive(coupon)}
                            className={`font-medium ${
                              coupon.isActive
                                ? 'text-orange-600 hover:text-orange-800'
                                : 'text-green-600 hover:text-green-800'
                            }`}
                          >
                            {coupon.isActive ? '비활성화' : '활성화'}
                          </button>
                          <button
                            onClick={() => handleDelete(coupon.id)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 쿠폰 생성/수정 모달 */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {editingCoupon ? '쿠폰 수정' : '새 쿠폰 생성'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* 쿠폰 코드 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      쿠폰 코드 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({ ...formData, code: e.target.value.toUpperCase() })
                      }
                      disabled={!!editingCoupon}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono uppercase disabled:bg-gray-100"
                      placeholder="WELCOME2024"
                      required
                    />
                  </div>

                  {/* 쿠폰명 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      쿠폰명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="신규 회원 환영 쿠폰"
                      required
                    />
                  </div>

                  {/* 설명 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      설명
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows={2}
                      placeholder="쿠폰 설명을 입력하세요"
                    />
                  </div>

                  {/* 쿠폰 타입 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      할인 타입 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          type: e.target.value as 'FIXED' | 'PERCENT' | 'FREE_SHIPPING',
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    >
                      <option value="FIXED">정액 할인</option>
                      <option value="PERCENT">정률 할인</option>
                      <option value="FREE_SHIPPING">무료 배송</option>
                    </select>
                  </div>

                  {/* 할인 값 */}
                  {formData.type !== 'FREE_SHIPPING' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        할인 값 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.value}
                        onChange={(e) =>
                          setFormData({ ...formData, value: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder={formData.type === 'FIXED' ? '10000' : '10'}
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {formData.type === 'FIXED'
                          ? '할인 금액 (원)'
                          : '할인율 (%)'}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {/* 최소 주문 금액 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        최소 주문 금액
                      </label>
                      <input
                        type="number"
                        value={formData.minAmount}
                        onChange={(e) =>
                          setFormData({ ...formData, minAmount: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="0"
                      />
                    </div>

                    {/* 최대 할인 금액 */}
                    {formData.type === 'PERCENT' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          최대 할인 금액
                        </label>
                        <input
                          type="number"
                          value={formData.maxDiscount}
                          onChange={(e) =>
                            setFormData({ ...formData, maxDiscount: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="무제한"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* 시작일 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        사용 시작일 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.validFrom}
                        onChange={(e) =>
                          setFormData({ ...formData, validFrom: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>

                    {/* 종료일 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        사용 종료일 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.validUntil}
                        onChange={(e) =>
                          setFormData({ ...formData, validUntil: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>
                  </div>

                  {/* 사용 제한 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      사용 가능 횟수
                    </label>
                    <input
                      type="number"
                      value={formData.usageLimit}
                      onChange={(e) =>
                        setFormData({ ...formData, usageLimit: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="무제한"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      비워두면 무제한 사용 가능
                    </p>
                  </div>

                  {/* 활성화 여부 */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label className="ml-2 text-sm text-gray-700">
                      쿠폰 활성화
                    </label>
                  </div>

                  {/* 버튼 */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setEditingCoupon(null);
                        resetForm();
                      }}
                      className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-medium"
                    >
                      {editingCoupon ? '수정하기' : '생성하기'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
