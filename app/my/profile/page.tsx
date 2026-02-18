'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: '홍길동',
    email: 'hong@example.com',
    phone: '010-1234-5678',
    address: '서울시 강남구 테헤란로 123',
    zipCode: '06234',
  });

  const [editedProfile, setEditedProfile] = useState({ ...profile });

  const handleEdit = () => {
    setIsEditing(true);
    setEditedProfile({ ...profile });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedProfile({ ...profile });
  };

  const handleSave = () => {
    setProfile({ ...editedProfile });
    setIsEditing(false);
    // TODO: API 호출하여 서버에 저장
    alert('회원 정보가 수정되었습니다.');
  };

  const handleChange = (field: string, value: string) => {
    setEditedProfile({ ...editedProfile, [field]: value });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 헤더 */}
      <header className="bg-gray-800/50 backdrop-blur-md border-b border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              Live Commerce
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/" className="text-gray-300 hover:text-white transition text-sm">
                홈
              </Link>
              <Link href="/shop" className="text-gray-300 hover:text-white transition text-sm">
                🛍️ 쇼핑몰
              </Link>
              <Link href="/my" className="text-blue-400 font-semibold text-sm">
                👤 마이페이지
              </Link>
              <Link href="/cart" className="relative text-gray-300 hover:text-white transition">
                <span className="text-2xl">🛒</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {/* 페이지 제목 */}
        <div className="mb-8">
          <Link href="/my" className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block">
            ← 마이페이지로 돌아가기
          </Link>
          <h1 className="text-4xl font-bold mb-2">⚙️ 회원 정보</h1>
          <p className="text-gray-400 text-lg">프로필 및 계정 설정을 관리하세요</p>
        </div>

        {/* 프로필 카드 */}
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-8 border-b border-gray-700">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-4xl">
                👤
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-2">{profile.name}</h2>
                <p className="text-gray-300">{profile.email}</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">기본 정보</h3>
              {!isEditing && (
                <button
                  onClick={handleEdit}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                >
                  수정하기
                </button>
              )}
            </div>

            <div className="space-y-6">
              {/* 이름 */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">이름</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedProfile.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
                  />
                ) : (
                  <div className="text-lg text-white">{profile.name}</div>
                )}
              </div>

              {/* 이메일 */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">이메일</label>
                {isEditing ? (
                  <input
                    type="email"
                    value={editedProfile.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
                  />
                ) : (
                  <div className="text-lg text-white">{profile.email}</div>
                )}
              </div>

              {/* 전화번호 */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">전화번호</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editedProfile.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
                  />
                ) : (
                  <div className="text-lg text-white">{profile.phone}</div>
                )}
              </div>

              {/* 우편번호 */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">우편번호</label>
                {isEditing ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editedProfile.zipCode}
                      onChange={(e) => handleChange('zipCode', e.target.value)}
                      className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
                    />
                    <button className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition">
                      주소 검색
                    </button>
                  </div>
                ) : (
                  <div className="text-lg text-white">{profile.zipCode}</div>
                )}
              </div>

              {/* 주소 */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">주소</label>
                {isEditing ? (
                  <textarea
                    value={editedProfile.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    rows={3}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition resize-none"
                  />
                ) : (
                  <div className="text-lg text-white">{profile.address}</div>
                )}
              </div>

              {/* 수정 버튼 */}
              {isEditing && (
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={handleSave}
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition"
                  >
                    저장하기
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold transition"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 추가 설정 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/my/orders"
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition group"
          >
            <div className="text-4xl mb-3">📦</div>
            <h3 className="text-lg font-bold mb-2 group-hover:text-blue-400 transition">주문 내역</h3>
            <p className="text-sm text-gray-400">나의 구매 내역 확인</p>
          </Link>

          <Link
            href="/wishlist"
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-pink-500 transition group"
          >
            <div className="text-4xl mb-3">💖</div>
            <h3 className="text-lg font-bold mb-2 group-hover:text-pink-400 transition">찜 목록</h3>
            <p className="text-sm text-gray-400">관심 상품 모음</p>
          </Link>

          <button className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-yellow-500 transition group text-left">
            <div className="text-4xl mb-3">🔔</div>
            <h3 className="text-lg font-bold mb-2 group-hover:text-yellow-400 transition">알림 설정</h3>
            <p className="text-sm text-gray-400">푸시 알림 및 이메일 설정</p>
          </button>

          <button className="bg-gray-800/50 border border-red-700 rounded-xl p-6 hover:border-red-500 transition group text-left">
            <div className="text-4xl mb-3">🚪</div>
            <h3 className="text-lg font-bold mb-2 group-hover:text-red-400 transition">로그아웃</h3>
            <p className="text-sm text-gray-400">현재 계정에서 로그아웃</p>
          </button>
        </div>
      </div>
    </div>
  );
}
