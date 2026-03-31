'use client';

// lib/hooks/useSocket.ts
// API 폴링 기반 라이브 채팅 훅 (Cloudflare Workers 호환)

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

interface UseSocketProps {
  liveId: string;
  userId?: string;
  userName?: string;
  userRole?: string;
}

const POLL_INTERVAL = 3000; // 3초마다 폴링

export function useSocket({ liveId, userId, userName, userRole }: UseSocketProps) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [typingUsers] = useState<string[]>([]);
  
  const lastMessageIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 초기 메시지 로드 및 폴링 시작
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const params = new URLSearchParams({ limit: '50' });
        if (lastMessageIdRef.current) {
          params.set('afterId', lastMessageIdRef.current);
        }
        
        const res = await fetch(`/api/lives/${liveId}/chat?${params}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.length > 0) {
            if (lastMessageIdRef.current) {
              // 새 메시지만 추가 (폴링)
              setMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const newMessages = data.data.filter((m: ChatMessage) => !existingIds.has(m.id));
                return [...newMessages, ...prev];
              });
            } else {
              // 초기 로드
              setMessages(data.data);
            }
            lastMessageIdRef.current = data.data[0]?.id || null;
          }
          setConnected(true);
        }
      } catch (error) {
        console.error('Chat fetch error:', error);
        setConnected(false);
      }
    };

    // 초기 로드
    fetchMessages();

    // 폴링 시작
    pollIntervalRef.current = setInterval(fetchMessages, POLL_INTERVAL);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [liveId]);

  // 메시지 전송
  const sendMessage = useCallback(async (message: string) => {
    if (!userId || !userName || !userRole) return;
    
    try {
      const res = await fetch(`/api/lives/${liveId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setMessages(prev => {
            const exists = prev.some(m => m.id === data.data.id);
            if (exists) return prev;
            return [data.data, ...prev];
          });
          lastMessageIdRef.current = data.data.id;
        }
      }
    } catch (error) {
      console.error('Send message error:', error);
    }
  }, [liveId, userId, userName, userRole]);

  // 타이핑 시작/중지 (API 폴링에서는 noop)
  const startTyping = useCallback(() => {}, []);
  const stopTyping = useCallback(() => {}, []);

  // 메시지 삭제
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      const res = await fetch(`/api/lives/${liveId}/chat?messageId=${messageId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
      }
    } catch (error) {
      console.error('Delete message error:', error);
    }
  }, [liveId]);

  return {
    socket: null,
    connected,
    messages,
    setMessages,
    viewerCount,
    typingUsers,
    sendMessage,
    startTyping,
    stopTyping,
    deleteMessage,
  };
}
