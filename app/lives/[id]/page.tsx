'use client';

// app/lives/[id]/page.tsx
// 라이브 시청 페이지 - Socket.io 실시간 채팅

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useSocket } from '@/lib/hooks/useSocket';

interface LiveData {
  id: string;
  title: string;
  description?: string;
  youtubeUrl?: string;
  streamUrl?: string;
  status: string;
  isLive: boolean;
  viewCount: number;
  partner: {
    storeName: string;
    logo?: string;
  };
  products?: Array<{
    id: string;
    name: string;
    slug: string;
    thumbnail: string;
    price: number;
    comparePrice?: number;
  }>;
}

export default function LiveViewPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token } = useAuth();
  
  const liveId = params.id as string;
  
  const [live, setLive] = useState<LiveData | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  // Socket.io 연결
  const {
    connected,
    messages,
    setMessages,
    viewerCount,
    typingUsers,
    sendMessage,
    startTyping,
    stopTyping,
  } = useSocket({
    liveId,
    userId: user?.userId,
    userName: user?.name,
    userRole: user?.role,
  });

  // 라이브 정보 로드
  const fetchLive = async () => {
    try {
      const res = await fetch(`/api/lives/${liveId}`);
      const data = await res.json();
      if (data.success) {
        setLive(data.live);
      } else {
        alert('라이브를 찾을 수 없습니다');
        router.push('/lives');
      }
    } catch (error) {
      console.error('라이브 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 초기 채팅 메시지 로드
  const fetchInitialMessages = async () => {
    try {
      const res = await fetch(`/api/lives/${liveId}/chat?limit=50`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages.reverse());
      }
    } catch (error) {
      console.error('채팅 로드 실패:', error);
    }
  };

  // 메시지 전송
  const handleSendMessage = () => {
    if (!user || !token) {
      alert('로그인이 필요합니다');
      router.push('/partner/login');
      return;
    }

    if (!newMessage.trim()) return;

    sendMessage(newMessage.trim());
    setNewMessage('');
    stopTyping();
  };

  // 타이핑 핸들러
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (e.target.value.length > 0) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  // YouTube Video ID 추출
  const getYouTubeVideoId = (url?: string): string | null => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? match[1] : null;
  };

  useEffect(() => {
    fetchLive();
    fetchInitialMessages();
  }, [liveId]);

  // 자동 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin mx-auto mb-4 h-12 w-12 border-4 border-red-500 border-t-transparent rounded-full"></div>
          <p className="text-white">라이브 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!live) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-white">라이브를 찾을 수 없습니다</p>
      </div>
    );
  }

  const videoId = getYouTubeVideoId(live.youtubeUrl || live.streamUrl);

  return (
    <div className="min-h-screen bg-gray-900">
      {/* 상단 헤더 */}
      <div className="bg-black text-white p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/lives" className="text-gray-400 hover:text-white">
            ← 목록으로
          </Link>
          <div className="flex items-center gap-4">
            {/* Socket 연결 상태 */}
            <span
              className={`text-xs px-2 py-1 rounded ${
                connected ? 'bg-green-500' : 'bg-red-500'
              }`}
            >
              {connected ? '🟢 연결됨' : '🔴 연결 끊김'}
            </span>
            
            {live.isLive && (
              <span className="px-3 py-1 bg-red-500 rounded-full text-sm font-bold flex items-center gap-2">
                <span className="animate-pulse">🔴</span>
                LIVE
              </span>
            )}
            
            {/* 실시간 접속자 수 */}
            <span className="text-gray-400 text-sm flex items-center gap-2">
              👥 {viewerCount.toLocaleString()}명 시청 중
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 왼쪽: 비디오 + 정보 */}
          <div className="lg:col-span-2 space-y-4">
            {/* YouTube 비디오 */}
            <div className="bg-black rounded-lg overflow-hidden aspect-video">
              {videoId ? (
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1`}
                  title={live.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                ></iframe>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white">
                  <div className="text-center">
                    <p className="text-4xl mb-2">📺</p>
                    <p>스트리밍 준비 중</p>
                  </div>
                </div>
              )}
            </div>

            {/* 라이브 정보 */}
            <div className="bg-gray-800 rounded-lg p-6 text-white">
              <h1 className="text-2xl font-bold mb-2">{live.title}</h1>
              <p className="text-gray-400 mb-4">{live.description}</p>
              
              <div className="flex items-center gap-3">
                {live.partner.logo && (
                  <img
                    src={live.partner.logo}
                    alt={live.partner.storeName}
                    className="w-12 h-12 rounded-full"
                  />
                )}
                <div>
                  <p className="font-medium">{live.partner.storeName}</p>
                  <p className="text-sm text-gray-400">파트너</p>
                </div>
              </div>
            </div>

            {/* 연결된 상품 */}
            {live.products && live.products.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-white text-xl font-bold mb-4">🛍️ 라이브 상품</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {live.products.map((product) => (
                    <Link
                      key={product.id}
                      href={`/products/${product.slug}`}
                      className="bg-gray-700 rounded-lg overflow-hidden hover:bg-gray-600 transition-colors"
                    >
                      <img
                        src={product.thumbnail}
                        alt={product.name}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="p-3">
                        <p className="text-white text-sm font-medium line-clamp-2">
                          {product.name}
                        </p>
                        <p className="text-red-400 font-bold mt-1">
                          {product.price.toLocaleString()}원
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽: 실시간 채팅 */}
          <div className="bg-gray-800 rounded-lg overflow-hidden flex flex-col h-[600px]">
            <div className="bg-gray-900 p-4 border-b border-gray-700">
              <h2 className="text-white font-bold">💬 실시간 채팅</h2>
              <p className="text-gray-400 text-sm">
                {messages.length}개 메시지
                {connected && <span className="ml-2 text-green-400">• 실시간 연결</span>}
              </p>
            </div>

            {/* 채팅 메시지 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <span
                    className={`font-semibold ${
                      msg.user.role === 'PARTNER'
                        ? 'text-yellow-400'
                        : msg.user.role === 'ADMIN'
                        ? 'text-red-400'
                        : 'text-blue-400'
                    }`}
                  >
                    {msg.user.name}
                  </span>
                  <span className="text-gray-400 text-xs ml-2">
                    {new Date(msg.createdAt).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <p className="text-white mt-1">{msg.message}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* 타이핑 인디케이터 */}
            {typingUsers.length > 0 && (
              <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-700">
                <span className="animate-pulse">
                  {typingUsers.join(', ')}님이 입력 중...
                </span>
              </div>
            )}

            {/* 메시지 입력 */}
            <div className="p-4 border-t border-gray-700">
              {user ? (
                <div className="flex gap-2">
                  <input
                    ref={messageInputRef}
                    type="text"
                    value={newMessage}
                    onChange={handleTyping}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    onBlur={stopTyping}
                    placeholder="메시지를 입력하세요..."
                    className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    maxLength={500}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!connected || !newMessage.trim()}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    전송
                  </button>
                </div>
              ) : (
                <Link
                  href="/partner/login"
                  className="block w-full text-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  로그인하고 채팅하기
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
