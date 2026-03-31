'use client';

// lib/hooks/useChat.ts
// API 폴링 기반 채팅 훅 (Vercel 서버리스 호환)

import { useEffect, useState, useRef, useCallback } from 'react';

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

interface UseChatProps {
  liveId: string;
  userId?: string;
  userName?: string;
  userRole?: string;
}

export function useChat({ liveId, userId, userName, userRole }: UseChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const lastMessageIdRef = useRef<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 초기 메시지 로드
  const fetchMessages = useCallback(async () => {
    try {
      const url = lastMessageIdRef.current
        ? `/api/lives/${liveId}/chat?limit=50&afterId=${lastMessageIdRef.current}`
        : `/api/lives/${liveId}/chat?limit=50`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success && data.messages.length > 0) {
        if (lastMessageIdRef.current) {
          // 새 메시지 추가
          setMessages((prev) => [...prev, ...data.messages.reverse()]);
        } else {
          // 초기 로드
          setMessages(data.messages.reverse());
        }
        // 마지막 메시지 ID 업데이트
        const lastMsg = data.messages[data.messages.length - 1];
        if (lastMsg) {
          lastMessageIdRef.current = lastMsg.id;
        }
      }
      setConnected(true);
    } catch (error) {
      console.error('채팅 로드 실패:', error);
      setConnected(false);
    }
  }, [liveId]);

  // 폴링 시작
  useEffect(() => {
    fetchMessages();

    // 2초마다 새 메시지 확인
    pollingRef.current = setInterval(fetchMessages, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchMessages]);

  // 메시지 전송
  const sendMessage = useCallback(
    async (message: string) => {
      if (!userId || !message.trim()) return;

      try {
        const token = localStorage.getItem('auth-token');
        const res = await fetch(`/api/lives/${liveId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message: message.trim() }),
        });

        const data = await res.json();
        if (data.success) {
          // 바로 메시지 추가 (폴링 대기 안 해도 됨)
          setMessages((prev) => [...prev, data.message]);
          lastMessageIdRef.current = data.message.id;
        }
      } catch (error) {
        console.error('메시지 전송 실패:', error);
      }
    },
    [liveId, userId]
  );

  // 메시지 삭제
  const deleteMessage = useCallback(
    async (messageId: string) => {
      try {
        const token = localStorage.getItem('auth-token');
        await fetch(`/api/lives/${liveId}/chat?messageId=${messageId}`, {
          method: 'DELETE',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      } catch (error) {
        console.error('메시지 삭제 실패:', error);
      }
    },
    [liveId]
  );

  return {
    connected,
    messages,
    setMessages,
    viewerCount,
    typingUsers: [] as string[],
    sendMessage,
    startTyping: () => {},
    stopTyping: () => {},
    deleteMessage,
  };
}
