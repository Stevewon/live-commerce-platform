'use client';

// components/NotificationBell.tsx
// 알림 벨 아이콘 & 드롭다운

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const { user, token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // 알림 불러오기
  const fetchNotifications = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=10', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('알림 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 알림 읽음 처리
  const markAsRead = async (id: string) => {
    if (!token) return;

    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        // 로컬 상태 업데이트
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('알림 읽음 처리 실패:', error);
    }
  };

  // 알림 삭제
  const deleteNotification = async (id: string) => {
    if (!token) return;

    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (error) {
      console.error('알림 삭제 실패:', error);
    }
  };

  // 초기 로드
  useEffect(() => {
    if (user && token) {
      fetchNotifications();
      // 30초마다 알림 갱신
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user, token]);

  // 드롭다운 토글
  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) fetchNotifications();
  };

  // 알림 타입별 아이콘
  const getTypeEmoji = (type: string) => {
    switch (type) {
      case 'ORDER_STATUS': return '📦';
      case 'SETTLEMENT': return '💰';
      case 'LIVE_START': return '📺';
      case 'REVIEW': return '⭐';
      case 'ANNOUNCEMENT': return '📢';
      default: return '🔔';
    }
  };

  // 로그인하지 않은 경우 표시 안 함
  if (!user) return null;

  return (
    <div className="relative">
      {/* 알림 벨 버튼 */}
      <button
        onClick={toggleDropdown}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* 드롭다운 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-h-[500px] overflow-y-auto bg-white border rounded-lg shadow-xl z-50">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="text-lg font-semibold">알림</h3>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-600">{unreadCount}개의 읽지 않은 알림</p>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <div className="animate-spin mx-auto mb-2 h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              로딩 중...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              알림이 없습니다
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    !notification.isRead ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">
                      {getTypeEmoji(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 text-sm">
                        {notification.title}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.content}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(notification.createdAt).toLocaleString('ko-KR')}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {!notification.isRead && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            읽음 처리
                          </button>
                        )}
                        {notification.link && (
                          <a
                            href={notification.link}
                            className="text-xs text-blue-600 hover:underline"
                            onClick={() => {
                              if (!notification.isRead) markAsRead(notification.id);
                              setIsOpen(false);
                            }}
                          >
                            바로가기
                          </a>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-3 border-t bg-gray-50 text-center">
            <button
              onClick={() => setIsOpen(false)}
              className="text-sm text-blue-600 hover:underline"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
