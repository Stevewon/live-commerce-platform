'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import Link from 'next/link';

interface Partner {
  id: string;
  storeName: string;
  storeSlug: string;
  isActive: boolean;
  commissionRate: number;
  user: {
    name: string;
    email: string;
    phone: string;
  };
  totalRevenue: number;
  _count: {
    products: number;
    orders: number;
  };
}

export default function AdminPartners() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/partner/login');
      return;
    }

    if (user?.role === 'ADMIN') {
      fetchPartners();
    }
  }, [user, authLoading, router, statusFilter]);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/partners?status=${statusFilter}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setPartners(result.data.partners);
      }
    } catch (err) {
      console.error('파트너 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (partnerId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/partners/${partnerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !currentStatus })
      });

      const result = await response.json();
      if (result.success) {
        alert('파트너 상태가 변경되었습니다');
        fetchPartners();
      }
    } catch (err) {
      console.error('상태 변경 실패:', err);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(price);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">파트너 관리</h1>
          <p className="mt-2 text-gray-600">파트너 조회 및 승인 관리</p>
        </div>

        <div className="mb-8 flex flex-wrap gap-4">
          <Link href="/admin" className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            대시보드
          </Link>
          <Link href="/admin/orders" className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            주문 관리
          </Link>
          <Link href="/admin/partners" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            파트너 관리
          </Link>
          <Link href="/admin/products" className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            상품 관리
          </Link>
        </div>

        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-2">
            {['all', 'active', 'inactive'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? '전체' : status === 'active' ? '활성' : '비활성'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">스토어명</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">운영자</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수수료율</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">총 매출</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품/주문</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {partners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-gray-900">{partner.storeName}</div>
                      <div className="text-xs text-gray-500">@{partner.storeSlug}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div>{partner.user.name}</div>
                      <div className="text-xs text-gray-400">{partner.user.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {partner.commissionRate}%
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {formatPrice(partner.totalRevenue)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {partner._count.products} / {partner._count.orders}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        partner.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {partner.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(partner.id, partner.isActive)}
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          partner.isActive
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {partner.isActive ? '비활성화' : '활성화'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
