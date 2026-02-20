// lib/socket.ts
// Socket.io 서버 초기화 (API route에서 사용)

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type SocketServer = SocketIOServer;

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('✅ Socket connected:', socket.id);

    // 라이브 방 입장
    socket.on('join-live', async (liveId: string) => {
      socket.join(`live:${liveId}`);
      console.log(`User ${socket.id} joined live:${liveId}`);
      
      // 현재 시청자 수 업데이트
      const room = io?.sockets.adapter.rooms.get(`live:${liveId}`);
      const viewerCount = room ? room.size : 0;
      
      io?.to(`live:${liveId}`).emit('viewer-count', viewerCount);
    });

    // 라이브 방 퇴장
    socket.on('leave-live', (liveId: string) => {
      socket.leave(`live:${liveId}`);
      console.log(`User ${socket.id} left live:${liveId}`);
      
      // 현재 시청자 수 업데이트
      const room = io?.sockets.adapter.rooms.get(`live:${liveId}`);
      const viewerCount = room ? room.size : 0;
      
      io?.to(`live:${liveId}`).emit('viewer-count', viewerCount);
    });

    // 채팅 메시지 전송
    socket.on('send-message', async (data: {
      liveId: string;
      userId: string;
      userName: string;
      userRole: string;
      message: string;
    }) => {
      try {
        // DB에 저장
        const chatMessage = await prisma.liveChat.create({
          data: {
            liveStreamId: data.liveId,
            userId: data.userId,
            message: data.message,
          },
        });

        // 방 전체에 브로드캐스트
        io?.to(`live:${data.liveId}`).emit('new-message', {
          id: chatMessage.id,
          message: data.message,
          user: {
            id: data.userId,
            name: data.userName,
            role: data.userRole,
          },
          createdAt: chatMessage.createdAt,
        });
      } catch (error) {
        console.error('Message save error:', error);
        socket.emit('error', '메시지 전송에 실패했습니다');
      }
    });

    // 메시지 삭제
    socket.on('delete-message', async (data: {
      messageId: string;
      liveId: string;
    }) => {
      try {
        await prisma.liveChat.update({
          where: { id: data.messageId },
          data: { isDeleted: true },
        });

        io?.to(`live:${data.liveId}`).emit('message-deleted', data.messageId);
      } catch (error) {
        console.error('Message delete error:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected:', socket.id);
    });
  });

  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}
