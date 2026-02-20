'use client';

// app/lives/[id]/page.tsx
// 라이브 시청 페이지 - YouTube 임베드 + 실시간 채팅

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';

interface ChatMessage {
  id: string;
  message: string;
  user: {
    id: string;
    name: string;
    role: string;
  };
  createdAt: string;
}

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const lastMessageId = useRef<string>('');

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

  // 채팅 메시지 로드 (초기)
  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/lives/${liveId}/chat?limit=50`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages);
        if (data.messages.length > 0) {
          lastMessageId.current = data.messages[0].id;
        }
      }
    } catch (error) {
      console.error('채팅 로드 실패:', error);
    }
  };

  // 새 메시지 폴링
  const pollNewMessages = async () => {
    if (!lastMessageId.current) return;
    
    try {
      const res = await fetch(`/api/lives/${liveId}/chat?afterId=${lastMessageId.current}&limit=50`);
      const data = await res.json();
      if (data.success && data.messages.length > 0) {
        setMessages((prev) => [...data.messages.reverse(), ...prev]);
        lastMessageId.current = data.messages[data.messages.length - 1].id;
      }
    } catch (error) {
      console.error('폴링 실패:', error);
    }
  };

  // 메시지 전송
  const sendMessage = async () => {
    if (!user || !token) {
      alert('로그인이 필요합니다');
      router.push('/partner/login');
      return;
    }

    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`/api/lives/${liveId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: newMessage }),
      });

      const data = await res.json();
      if (data.success) {
        setNewMessage('');
        // 폴링으로 곧 나타날 것이므로 즉시 추가하지 않음
      } else {
        alert(data.error || '메시지 전송 실패');
      }
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      alert('메시지 전송 실패');
    } finally {
      setSending(false);
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
    fetchMessages();
    
    // 3초마다 새 메시지 폴링
    const interval = setInterval(pollNewMessages, 3000);
    return () => clearInterval(interval);
  }, [liveId]);

  // 자동 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mx-auto mb-4 h-12 w-12 border-4 border-red-500 border-t-transparent rounded-full"></div>
          <p className="text-gray-600">라이브 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!live) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">라이브를 찾을 수 없습니다</p>
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
            {live.isLive && (
              <span className="px-3 py-1 bg-red-500 rounded-full text-sm font-bold flex items-center gap-2">
                <span className="animate-pulse">🔴</span>
                LIVE
              </span>
            )}
            <span className="text-gray-400 text-sm">👁️ {live.viewCount.toLocaleString()}</span>
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

          {/* 오른쪽: 채팅 */}
          <div className="bg-gray-800 rounded-lg overflow-hidden flex flex-col h-[600px]">
            <div className="bg-gray-900 p-4 border-b border-gray-700">
              <h2 className="text-white font-bold">💬 실시간 채팅</h2>
              <p className="text-gray-400 text-sm">{messages.length}개 메시지</p>
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

            {/* 메시지 입력 */}
            <div className="p-4 border-t border-gray-700">
              {user ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !sending && sendMessage()}
                    placeholder="메시지를 입력하세요..."
                    className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    disabled={sending}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
