'use client';

// app/lives/page.tsx
// 라이브 목록 페이지

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import ShopNavigation from '@/components/ShopNavigation';
import { proxyImg } from '@/lib/utils/imgProxy';

interface Live {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  status: string;
  isLive: boolean;
  viewCount: number;
  scheduledAt?: string;
  partner: {
    storeName: string;
    storeSlug: string;
    logo?: string;
  };
  _count: {
    chatMessages: number;
    orders: number;
  };
}

export default function LivesPage() {
  const [lives, setLives] = useState<Live[]>([]);
  const [status, setStatus] = useState<string>('LIVE');
  const [loading, setLoading] = useState(true);

  const fetchLives = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lives?status=${status}&limit=20`);
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

  useEffect(() => {
    fetchLives();
    // 30초마다 갱신
    const interval = setInterval(fetchLives, 30000);
    return () => clearInterval(interval);
  }, [status]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 공통 네비게이션 (모바일 최적화 헤더) */}
      <ShopNavigation />

      {/* 페이지 타이틀 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">🔴 라이브 쇼핑</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">실시간 라이브 방송을 시청하세요</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['LIVE', 'SCHEDULED', 'ENDED', 'ALL'].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-lg font-medium transition-colors ${
                status === s
                  ? 'bg-red-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {s === 'LIVE' && '🔴 라이브'}
              {s === 'SCHEDULED' && '📅 예정'}
              {s === 'ENDED' && '⏹️ 종료'}
              {s === 'ALL' && '전체'}
            </button>
          ))}
        </div>
      </div>

      {/* 라이브 목록 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin mx-auto mb-4 h-12 w-12 border-4 border-red-500 border-t-transparent rounded-full"></div>
            <p className="text-gray-600">로딩 중...</p>
          </div>
        ) : lives.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-600 text-lg">진행 중인 라이브가 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lives.map((live) => (
              <Link
                key={live.id}
                href={`/lives/${live.id}`}
                className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow"
              >
                {/* 썸네일 */}
                <div className="relative aspect-video bg-gray-900">
                  {live.thumbnail ? (
                    <img
                      src={proxyImg(live.thumbnail)}
                      alt={live.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-white text-4xl">📺</div>';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-4xl">
                      📺
                    </div>
                  )}
                  
                  {/* LIVE 뱃지 */}
                  {live.isLive && (
                    <div className="absolute top-3 left-3 px-3 py-1 bg-red-500 text-white font-bold rounded-md flex items-center gap-2">
                      <span className="animate-pulse">🔴</span>
                      LIVE
                    </div>
                  )}

                  {/* 조회수 */}
                  <div className="absolute bottom-3 right-3 px-2 py-1 bg-black bg-opacity-70 text-white text-sm rounded">
                    👁️ {live.viewCount.toLocaleString()}
                  </div>
                </div>

                {/* 정보 */}
                <div className="p-4">
                  <h3 className="font-bold text-lg text-gray-900 line-clamp-2 mb-2">
                    {live.title}
                  </h3>
                  
                  {/* 파트너 정보 */}
                  <div className="flex items-center gap-2 mb-3">
                    {live.partner.logo ? (
                      <img
                        src={proxyImg(live.partner.logo)}
                        alt={live.partner.storeName}
                        loading="lazy"
                        className="w-8 h-8 rounded-full"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML = '<div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm">🏪</div>';
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm">
                        🏪
                      </div>
                    )}
                    <span className="text-gray-600 text-sm">{live.partner.storeName}</span>
                  </div>

                  {/* 통계 */}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>💬 {live._count.chatMessages.toLocaleString()}</span>
                    <span>🛒 {live._count.orders}</span>
                    {live.scheduledAt && !live.isLive && (
                      <span className="text-xs">
                        {new Date(live.scheduledAt).toLocaleString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
