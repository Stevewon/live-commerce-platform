'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import ShopNavigation from '@/components/ShopNavigation';

interface ProfileForm {
  name: string;
  email: string;
  phone: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading, logout, refreshUser } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<ProfileForm>({ name: '', email: '', phone: '' });
  const [editedProfile, setEditedProfile] = useState<ProfileForm>({ name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 인증 게이트
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?redirect=/my/profile');
    }
  }, [user, authLoading, router]);

  // 실 사용자 데이터로 form 초기화
  useEffect(() => {
    if (user) {
      const initial = {
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
      };
      setProfile(initial);
      setEditedProfile(initial);
    }
  }, [user]);

  const handleEdit = () => {
    setIsEditing(true);
    setError('');
    setSuccess('');
    setEditedProfile({ ...profile });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
    setEditedProfile({ ...profile });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editedProfile.name,
          email: editedProfile.email || null,
          phone: editedProfile.phone || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || '회원 정보 수정에 실패했습니다.');
        return;
      }
      setProfile({ ...editedProfile });
      setIsEditing(false);
      setSuccess('회원 정보가 수정되었습니다.');
      // AuthContext 의 user 정보도 새로 가져와 헤더/마이페이지에 즉시 반영
      await refreshUser();
      // 3초 뒤 success 메시지 자동 제거
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('프로필 저장 실패:', err);
      setError('네트워크 오류로 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof ProfileForm, value: string) => {
    setEditedProfile({ ...editedProfile, [field]: value });
  };

  const handleLogout = async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    try {
      await logout();
    } catch (err) {
      console.error('로그아웃 실패:', err);
    }
  };

  // 인증 로딩 중 또는 미인증 → 로딩 스피너 (리다이렉트 진행 중)
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 text-base">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      <ShopNavigation />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-4xl">
        {/* 페이지 제목 */}
        <div className="mb-6 sm:mb-8">
          <Link href="/my" className="text-blue-600 hover:text-blue-700 text-sm mb-2 inline-block">
            ← 마이페이지로 돌아가기
          </Link>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">⚙️ 회원 정보</h1>
          <p className="text-gray-500 text-sm sm:text-base lg:text-lg">프로필 및 계정 설정을 관리하세요</p>
        </div>

        {/* 알림 메시지 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            {success}
          </div>
        )}

        {/* 프로필 카드 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6 sm:p-8">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center text-3xl sm:text-4xl flex-shrink-0">
                👤
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 truncate">
                  {profile.name || user.nickname || '회원'}
                </h2>
                <p className="text-white/80 text-sm sm:text-base truncate">
                  {profile.email || `@${user.nickname || ''}`}
                </p>
                {user.role && user.role !== 'CUSTOMER' && (
                  <span className="inline-block mt-2 px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-xs text-white font-semibold">
                    {user.role}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">기본 정보</h3>
              {!isEditing && (
                <button
                  onClick={handleEdit}
                  className="px-4 sm:px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
                >
                  수정하기
                </button>
              )}
            </div>

            <div className="space-y-5">
              {/* 닉네임 (수정 불가, 표시만) */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">닉네임</label>
                <div className="text-base text-gray-900">
                  {user.nickname || '-'}
                  <span className="ml-2 text-xs text-gray-400">(변경 불가)</span>
                </div>
              </div>

              {/* 이름 */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  이름 <span className="text-red-500">*</span>
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedProfile.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    maxLength={50}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                    placeholder="이름을 입력하세요"
                  />
                ) : (
                  <div className="text-base text-gray-900">{profile.name || '-'}</div>
                )}
              </div>

              {/* 이메일 */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">이메일</label>
                {isEditing ? (
                  <input
                    type="email"
                    value={editedProfile.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                    placeholder="example@email.com"
                  />
                ) : (
                  <div className="text-base text-gray-900">{profile.email || '-'}</div>
                )}
              </div>

              {/* 전화번호 */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">전화번호</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editedProfile.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                    placeholder="010-0000-0000"
                  />
                ) : (
                  <div className="text-base text-gray-900">{profile.phone || '-'}</div>
                )}
              </div>

              {/* 수정 버튼 */}
              {isEditing && (
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving || !editedProfile.name.trim()}
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold transition"
                  >
                    {saving ? '저장 중...' : '저장하기'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition disabled:opacity-50"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 추가 설정 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <Link
            href="/my-orders"
            className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 hover:border-blue-500 hover:shadow-md transition group"
          >
            <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">📦</div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition">
              주문 내역
            </h3>
            <p className="text-xs sm:text-sm text-gray-500">나의 구매 내역 확인</p>
          </Link>

          <Link
            href="/wishlist"
            className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 hover:border-pink-500 hover:shadow-md transition group"
          >
            <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">💖</div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1 group-hover:text-pink-600 transition">
              찜 목록
            </h3>
            <p className="text-xs sm:text-sm text-gray-500">관심 상품 모음</p>
          </Link>

          <Link
            href="/my/coupons"
            className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 hover:border-yellow-500 hover:shadow-md transition group"
          >
            <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">🎟️</div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1 group-hover:text-yellow-600 transition">
              내 쿠폰
            </h3>
            <p className="text-xs sm:text-sm text-gray-500">사용 가능 쿠폰 확인</p>
          </Link>

          <button
            onClick={handleLogout}
            className="bg-white border border-red-200 rounded-xl p-5 sm:p-6 hover:border-red-500 hover:shadow-md transition group text-left w-full"
          >
            <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">🚪</div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1 group-hover:text-red-600 transition">
              로그아웃
            </h3>
            <p className="text-xs sm:text-sm text-gray-500">현재 계정에서 로그아웃</p>
          </button>
        </div>
      </div>
    </div>
  );
}
