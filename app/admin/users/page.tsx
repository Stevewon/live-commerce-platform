'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import Link from 'next/link';

interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: 'CUSTOMER' | 'PARTNER' | 'ADMIN';
  emailVerified: boolean | null;
  createdAt: string;
  _count?: {
    orders: number;
  };
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!authLoading && (!currentUser || currentUser.role !== 'ADMIN')) {
      router.push('/partner/login');
      return;
    }

    if (currentUser?.role === 'ADMIN') {
      fetchUsers();
    }
  }, [currentUser, authLoading, router]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error('회원 목록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('정말로 이 회원을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        alert('회원이 삭제되었습니다.');
        fetchUsers();
      } else {
        alert('회원 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('회원 삭제 실패:', error);
      alert('회원 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        alert('권한이 변경되었습니다.');
        fetchUsers();
      } else {
        alert('권한 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('권한 변경 실패:', error);
      alert('권한 변경 중 오류가 발생했습니다.');
    }
  };

  const getRoleBadge = (role: string) => {
    const badges = {
      ADMIN: 'bg-purple-100 text-purple-800',
      PARTNER: 'bg-green-100 text-green-800',
      CUSTOMER: 'bg-blue-100 text-blue-800'
    };
    const labels = {
      ADMIN: '관리자',
      PARTNER: '파트너',
      CUSTOMER: '고객'
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badges[role as keyof typeof badges]}`}>
        {labels[role as keyof typeof labels]}
      </span>
    );
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

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
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">회원 관리</h1>
          <p className="mt-2 text-gray-600">플랫폼 회원 조회 및 관리</p>
        </div>

        {/* 네비게이션 */}
        <div className="mb-8 flex flex-wrap gap-4">
          <Link href="/admin" className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            대시보드
          </Link>
          <Link href="/admin/users" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            👥 회원 관리
          </Link>
          <Link href="/admin/orders" className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            주문 관리
          </Link>
          <Link href="/admin/partners" className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            파트너 관리
          </Link>
          <Link href="/admin/products" className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            상품 관리
          </Link>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">전체 회원</div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{users.length}명</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">고객</div>
            <div className="text-2xl font-bold text-blue-600 mt-2">
              {users.filter(u => u.role === 'CUSTOMER').length}명
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">파트너</div>
            <div className="text-2xl font-bold text-green-600 mt-2">
              {users.filter(u => u.role === 'PARTNER').length}명
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">관리자</div>
            <div className="text-2xl font-bold text-purple-600 mt-2">
              {users.filter(u => u.role === 'ADMIN').length}명
            </div>
          </div>
        </div>

        {/* 필터 및 검색 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="이름 또는 이메일로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setRoleFilter('ALL')}
                className={`px-4 py-2 rounded-lg ${roleFilter === 'ALL' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                전체
              </button>
              <button
                onClick={() => setRoleFilter('CUSTOMER')}
                className={`px-4 py-2 rounded-lg ${roleFilter === 'CUSTOMER' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                고객
              </button>
              <button
                onClick={() => setRoleFilter('PARTNER')}
                className={`px-4 py-2 rounded-lg ${roleFilter === 'PARTNER' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                파트너
              </button>
              <button
                onClick={() => setRoleFilter('ADMIN')}
                className={`px-4 py-2 rounded-lg ${roleFilter === 'ADMIN' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                관리자
              </button>
            </div>
          </div>
        </div>

        {/* 회원 목록 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    회원 정보
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    연락처
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    권한
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주문수
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    가입일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      회원이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <span className="text-purple-600 font-semibold text-lg">
                              {user.name.charAt(0)}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.phone || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user._count?.orders || 0}건</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs"
                            disabled={user.id === currentUser?.id}
                          >
                            <option value="CUSTOMER">고객</option>
                            <option value="PARTNER">파트너</option>
                            <option value="ADMIN">관리자</option>
                          </select>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={user.id === currentUser?.id}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-xs"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 결과 요약 */}
        <div className="mt-4 text-sm text-gray-600 text-center">
          전체 {users.length}명 중 {filteredUsers.length}명 표시
        </div>
      </div>
    </div>
  );
}
