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
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'orders'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
      ADMIN: 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md',
      PARTNER: 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md',
      CUSTOMER: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
    };
    const labels = {
      ADMIN: '🔑 관리자',
      PARTNER: '🤝 파트너',
      CUSTOMER: '👤 고객'
    };
    return (
      <span className={`px-3 py-1.5 text-xs font-bold rounded-full ${badges[role as keyof typeof badges]}`}>
        {labels[role as keyof typeof labels]}
      </span>
    );
  };

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const toggleAllUsers = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const getSortedUsers = (usersToSort: User[]) => {
    return [...usersToSort].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'orders':
          comparison = (a._count?.orders || 0) - (b._count?.orders || 0);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const filteredUsers = getSortedUsers(users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  }));

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
          <p className="mt-6 text-gray-600 font-medium">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-purple-50">
      {/* 고급스러운 헤더 */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                회원 관리
              </h1>
              <p className="mt-2 text-gray-600 text-lg">플랫폼 회원 조회 및 관리 시스템</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm text-gray-500">관리자</div>
                <div className="text-lg font-semibold text-gray-900">{currentUser?.name}</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                {currentUser?.name?.charAt(0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 프리미엄 네비게이션 */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-2 inline-flex space-x-2">
            <Link href="/admin" className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-all font-medium">
              📊 대시보드
            </Link>
            <Link href="/admin/users" className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl shadow-md font-medium">
              👥 회원 관리
            </Link>
            <Link href="/admin/orders" className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-all font-medium">
              📦 주문 관리
            </Link>
            <Link href="/admin/partners" className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-all font-medium">
              🤝 파트너 관리
            </Link>
            <Link href="/admin/products" className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-all font-medium">
              🛍️ 상품 관리
            </Link>
          </div>
        </div>

        {/* 프리미엄 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-purple-500 hover:shadow-2xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">전체 회원</div>
                <div className="text-3xl font-bold text-gray-900 mt-2">{users.length}</div>
                <div className="text-xs text-gray-500 mt-1">Total Members</div>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl flex items-center justify-center">
                <span className="text-3xl">👥</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-blue-500 hover:shadow-2xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">고객</div>
                <div className="text-3xl font-bold text-blue-600 mt-2">
                  {users.filter(u => u.role === 'CUSTOMER').length}
                </div>
                <div className="text-xs text-gray-500 mt-1">Customers</div>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center">
                <span className="text-3xl">🛒</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-green-500 hover:shadow-2xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">파트너</div>
                <div className="text-3xl font-bold text-green-600 mt-2">
                  {users.filter(u => u.role === 'PARTNER').length}
                </div>
                <div className="text-xs text-gray-500 mt-1">Partners</div>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl flex items-center justify-center">
                <span className="text-3xl">🤝</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-indigo-500 hover:shadow-2xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">관리자</div>
                <div className="text-3xl font-bold text-indigo-600 mt-2">
                  {users.filter(u => u.role === 'ADMIN').length}
                </div>
                <div className="text-xs text-gray-500 mt-1">Admins</div>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-2xl flex items-center justify-center">
                <span className="text-3xl">🔑</span>
              </div>
            </div>
          </div>
        </div>

        {/* 프리미엄 검색 & 필터 */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* 검색 */}
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="이름 또는 이메일로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-lg"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
                  🔍
                </div>
              </div>
            </div>

            {/* 정렬 */}
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent font-medium"
              >
                <option value="date">가입일순</option>
                <option value="name">이름순</option>
                <option value="orders">주문수순</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-4 py-4 border-2 border-gray-200 rounded-xl hover:bg-gray-50 font-medium"
              >
                {sortOrder === 'asc' ? '↑ 오름차순' : '↓ 내림차순'}
              </button>
            </div>

            {/* 권한 필터 */}
            <div className="flex gap-2">
              <button
                onClick={() => setRoleFilter('ALL')}
                className={`px-6 py-4 rounded-xl font-bold transition-all ${
                  roleFilter === 'ALL' 
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setRoleFilter('CUSTOMER')}
                className={`px-6 py-4 rounded-xl font-bold transition-all ${
                  roleFilter === 'CUSTOMER' 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                고객
              </button>
              <button
                onClick={() => setRoleFilter('PARTNER')}
                className={`px-6 py-4 rounded-xl font-bold transition-all ${
                  roleFilter === 'PARTNER' 
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                파트너
              </button>
              <button
                onClick={() => setRoleFilter('ADMIN')}
                className={`px-6 py-4 rounded-xl font-bold transition-all ${
                  roleFilter === 'ADMIN' 
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                관리자
              </button>
            </div>
          </div>

          {/* 선택된 항목 액션 */}
          {selectedUsers.size > 0 && (
            <div className="mt-4 p-4 bg-purple-50 rounded-xl flex items-center justify-between">
              <span className="text-purple-700 font-semibold">
                {selectedUsers.size}명 선택됨
              </span>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium">
                  일괄 삭제
                </button>
                <button 
                  onClick={() => setSelectedUsers(new Set())}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium"
                >
                  선택 해제
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 프리미엄 테이블 */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <th className="px-6 py-5 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                      onChange={toggleAllUsers}
                      className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    회원 정보
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    연락처
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    권한
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    활동
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    가입일
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="text-gray-400 text-lg">
                        <div className="text-6xl mb-4">🔍</div>
                        <div className="font-semibold">검색 결과가 없습니다</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, index) => (
                    <tr 
                      key={user.id} 
                      className="hover:bg-purple-50 transition-colors group"
                    >
                      <td className="px-6 py-5">
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center shadow-lg">
                              <span className="text-white font-bold text-lg">
                                {user.name.charAt(0)}
                              </span>
                            </div>
                          </div>
                          <div>
                            <div className="text-base font-bold text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <span className="mr-2">✉️</span>
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm text-gray-700 font-medium">
                          {user.phone ? (
                            <div className="flex items-center">
                              <span className="mr-2">📱</span>
                              {user.phone}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center space-x-3">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">
                              {user._count?.orders || 0}
                            </div>
                            <div className="text-xs text-gray-500">주문</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm text-gray-700 font-medium">
                          {new Date(user.createdAt).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(user.createdAt).toLocaleTimeString('ko-KR')}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            disabled={user.id === currentUser?.id}
                            className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                          >
                            <option value="CUSTOMER">고객</option>
                            <option value="PARTNER">파트너</option>
                            <option value="ADMIN">관리자</option>
                          </select>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={user.id === currentUser?.id}
                            className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed font-medium shadow-md transition-all text-sm"
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
        <div className="mt-6 bg-white rounded-2xl shadow-lg p-6 flex items-center justify-between">
          <div className="text-gray-600">
            전체 <span className="font-bold text-purple-600">{users.length}</span>명 중{' '}
            <span className="font-bold text-purple-600">{filteredUsers.length}</span>명 표시
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span>Last updated:</span>
            <span className="font-semibold">{new Date().toLocaleString('ko-KR')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
