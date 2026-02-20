'use client';

// lib/hooks/useSocket.ts
// Socket.io 클라이언트 훅

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

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

export function useSocket({ liveId, userId, userName, userRole }: UseSocketProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Socket 연결
  useEffect(() => {
    const socketInstance = io({
      path: '/socket.io',
    });

    socketInstance.on('connect', () => {
      console.log('✅ Socket connected:', socketInstance.id);
      setConnected(true);
      setSocket(socketInstance);

      // 라이브 방 입장
      if (userId && userName && userRole) {
        socketInstance.emit('join-live', {
          liveId,
          userId,
          userName,
          userRole,
        });
      }
    });

    socketInstance.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setConnected(false);
    });

    // 새 메시지 수신
    socketInstance.on('new-message', (message: ChatMessage) => {
      setMessages((prev) => [message, ...prev]);
    });

    // 접속자 수 업데이트
    socketInstance.on('viewer-count', (count: number) => {
      setViewerCount(count);
    });

    // 사용자 입장
    socketInstance.on('user-joined', (data: { userName: string; viewerCount: number }) => {
      console.log(`${data.userName} joined. Viewers: ${data.viewerCount}`);
    });

    // 사용자 퇴장
    socketInstance.on('user-left', (data: { userName: string; viewerCount: number }) => {
      console.log(`${data.userName} left. Viewers: ${data.viewerCount}`);
    });

    // 타이핑 인디케이터
    socketInstance.on('user-typing', (data: { userName: string; isTyping: boolean }) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        if (data.isTyping) {
          newSet.add(data.userName);
        } else {
          newSet.delete(data.userName);
        }
        return newSet;
      });
    });

    // 메시지 삭제
    socketInstance.on('message-deleted', (messageId: string) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    });

    // 에러
    socketInstance.on('error', (error: string) => {
      console.error('Socket error:', error);
      alert(error);
    });

    return () => {
      if (userId) {
        socketInstance.emit('leave-live', liveId);
      }
      socketInstance.disconnect();
    };
  }, [liveId, userId, userName, userRole]);

  // 메시지 전송
  const sendMessage = (message: string) => {
    if (socket && connected && userId && userName && userRole) {
      socket.emit('send-message', {
        liveId,
        userId,
        userName,
        userRole,
        message,
      });
    }
  };

  // 타이핑 시작
  const startTyping = () => {
    if (socket && connected && userName) {
      socket.emit('typing-start', { liveId, userName });
      
      // 3초 후 자동으로 타이핑 중지
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 3000);
    }
  };

  // 타이핑 중지
  const stopTyping = () => {
    if (socket && connected && userName) {
      socket.emit('typing-stop', { liveId, userName });
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  // 메시지 삭제
  const deleteMessage = (messageId: string) => {
    if (socket && connected) {
      socket.emit('delete-message', { messageId, liveId });
    }
  };

  return {
    socket,
    connected,
    messages,
    setMessages,
    viewerCount,
    typingUsers: Array.from(typingUsers),
    sendMessage,
    startTyping,
    stopTyping,
    deleteMessage,
  };
}
