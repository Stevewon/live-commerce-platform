'use client';

// app/partner/lives/page.tsx
// 파트너 라이브 관리 페이지

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Live {
  id: string;
  title: string;
  description?: string;
  youtubeUrl?: string;
  status: string;
  isLive: boolean;
  viewCount: number;
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  _count: {
    chatMessages: number;
    orders: number;
  };
}

export default function PartnerLivesPage() {
  const router = useRouter();
  const user = null, loading = false // Temp;
  
  const [lives, setLives] = useState<Live[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // 새 라이브 폼
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    youtubeUrl: '',
    scheduledAt: '',
  });

  // 권한 확인
  useEffect(() => {
    if (!user) {
      alert('로그인이 필요합니다');
      router.push('/partner/login');
      return;
    }
    if (user.role !== 'PARTNER') {
      alert('파트너 권한이 필요합니다');
      router.push('/');
      return;
    }
  }, [user]);

  // 라이브 목록 로드
  const fetchLives = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/partner/lives', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setLives(data.lives);
      }
    } catch (error) {
      console.error('라이브 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 라이브 생성
  const createLive = async () => {
    if (!token) return;
    
    if (!formData.title || !formData.youtubeUrl) {
      alert('제목과 YouTube URL은 필수입니다');
      return;
    }

    try {
      const res = await fetch('/api/partner/lives', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        alert('라이브가 생성되었습니다!');
        setShowForm(false);
        setFormData({ title: '', description: '', youtubeUrl: '', scheduledAt: '' });
        fetchLives();
      } else {
        alert(data.error || '라이브 생성 실패');
      }
    } catch (error) {
      console.error('라이브 생성 실패:', error);
      alert('라이브 생성 실패');
    }
  };

  // 상태 변경
  const changeStatus = async (liveId: string, newStatus: string) => {
    if (!token) return;
    
    if (!confirm(`라이브를 "${newStatus}" 상태로 변경하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/partner/lives/${liveId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (data.success) {
        alert('상태가 변경되었습니다');
        fetchLives();
      } else {
        alert(data.error || '상태 변경 실패');
      }
    } catch (error) {
      console.error('상태 변경 실패:', error);
      alert('상태 변경 실패');
    }
  };

  // 라이브 삭제
  const deleteLive = async (liveId: string) => {
    if (!token) return;
    
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/partner/lives/${liveId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.success) {
        alert('라이브가 삭제되었습니다');
        fetchLives();
      } else {
        alert(data.error || '삭제 실패');
      }
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제 실패');
    }
  };

  useEffect(() => {
    if (user && token) {
      fetchLives();
    }
  }, [user, token]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📺 라이브 관리</h1>
              <p className="text-gray-600 mt-1">라이브 방송을 생성하고 관리하세요</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/partner/dashboard"
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              >
                대시보드
              </Link>
              <button
                onClick={() => setShowForm(!showForm)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                + 라이브 생성
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 라이브 생성 폼 */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">새 라이브 생성</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  제목 *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="예: 🔴 신상품 출시 기념 라이브!"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설명
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="라이브 설명을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  YouTube URL *
                </label>
                <input
                  type="url"
                  value={formData.youtubeUrl}
                  onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  예정 시작 시간 (선택)
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={createLive}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  생성
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 라이브 목록 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin mx-auto mb-4 h-12 w-12 border-4 border-red-500 border-t-transparent rounded-full"></div>
            <p className="text-gray-600">로딩 중...</p>
          </div>
        ) : lives.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-600 text-lg">생성된 라이브가 없습니다</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              첫 라이브 만들기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {lives.map((live) => (
              <div key={live.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{live.title}</h3>
                      {live.isLive && (
                        <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded flex items-center gap-1">
                          <span className="animate-pulse">🔴</span>
                          LIVE
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          live.status === 'LIVE'
                            ? 'bg-red-100 text-red-700'
                            : live.status === 'SCHEDULED'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {live.status}
                      </span>
                    </div>

                    {live.description && (
                      <p className="text-gray-600 mb-3">{live.description}</p>
                    )}

                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <span>👁️ {live.viewCount.toLocaleString()}</span>
                      <span>💬 {live._count.chatMessages.toLocaleString()}</span>
                      <span>🛒 {live._count.orders}</span>
                      {live.scheduledAt && (
                        <span>
                          📅 {new Date(live.scheduledAt).toLocaleString('ko-KR')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    {live.status === 'SCHEDULED' && (
                      <button
                        onClick={() => changeStatus(live.id, 'LIVE')}
                        className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 whitespace-nowrap"
                      >
                        ▶️ 시작
                      </button>
                    )}
                    {live.status === 'LIVE' && (
                      <button
                        onClick={() => changeStatus(live.id, 'ENDED')}
                        className="px-4 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-800 whitespace-nowrap"
                      >
                        ⏹️ 종료
                      </button>
                    )}
                    <Link
                      href={`/lives/${live.id}`}
                      className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 text-center whitespace-nowrap"
                    >
                      👁️ 보기
                    </Link>
                    {!live.isLive && (
                      <button
                        onClick={() => deleteLive(live.id)}
                        className="px-4 py-2 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 whitespace-nowrap"
                      >
                        🗑️ 삭제
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
