// server.js
// Next.js 15 + Socket.io 커스텀 서버

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const prisma = new PrismaClient();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // 방별 접속자 정보 저장
  const roomUsers = new Map();

  io.on('connection', (socket) => {
    console.log('✅ Socket connected:', socket.id);

    // 라이브 방 입장
    socket.on('join-live', async (data) => {
      const { liveId, userId, userName, userRole } = data;
      
      socket.join(`live:${liveId}`);
      
      // 사용자 정보 저장
      const roomKey = `live:${liveId}`;
      if (!roomUsers.has(roomKey)) {
        roomUsers.set(roomKey, new Map());
      }
      roomUsers.get(roomKey).set(socket.id, { userId, userName, userRole });

      const viewerCount = roomUsers.get(roomKey).size;
      
      console.log(`User ${userName} (${socket.id}) joined ${roomKey}. Viewers: ${viewerCount}`);
      
      // 모든 참가자에게 접속자 수 브로드캐스트
      io.to(roomKey).emit('viewer-count', viewerCount);
      
      // 입장 알림
      io.to(roomKey).emit('user-joined', {
        userName,
        userRole,
        viewerCount,
      });
    });

    // 라이브 방 퇴장
    socket.on('leave-live', (liveId) => {
      const roomKey = `live:${liveId}`;
      
      if (roomUsers.has(roomKey)) {
        const user = roomUsers.get(roomKey).get(socket.id);
        roomUsers.get(roomKey).delete(socket.id);
        
        const viewerCount = roomUsers.get(roomKey).size;
        
        if (user) {
          console.log(`User ${user.userName} left ${roomKey}. Viewers: ${viewerCount}`);
          
          // 퇴장 알림
          io.to(roomKey).emit('user-left', {
            userName: user.userName,
            viewerCount,
          });
        }
        
        io.to(roomKey).emit('viewer-count', viewerCount);
      }
      
      socket.leave(roomKey);
    });

    // 채팅 메시지 전송
    socket.on('send-message', async (data) => {
      const { liveId, userId, userName, userRole, message } = data;
      
      try {
        // DB에 저장
        const chatMessage = await prisma.liveChat.create({
          data: {
            liveStreamId: liveId,
            userId: userId,
            message: message,
          },
        });

        // 방 전체에 실시간 브로드캐스트
        io.to(`live:${liveId}`).emit('new-message', {
          id: chatMessage.id,
          message: message,
          user: {
            id: userId,
            name: userName,
            role: userRole,
          },
          createdAt: chatMessage.createdAt.toISOString(),
        });
        
        console.log(`Message from ${userName}: ${message}`);
      } catch (error) {
        console.error('Message save error:', error);
        socket.emit('error', '메시지 전송에 실패했습니다');
      }
    });

    // 타이핑 인디케이터
    socket.on('typing-start', (data) => {
      const { liveId, userName } = data;
      socket.to(`live:${liveId}`).emit('user-typing', { userName, isTyping: true });
    });

    socket.on('typing-stop', (data) => {
      const { liveId, userName } = data;
      socket.to(`live:${liveId}`).emit('user-typing', { userName, isTyping: false });
    });

    // 메시지 삭제
    socket.on('delete-message', async (data) => {
      const { messageId, liveId } = data;
      
      try {
        await prisma.liveChat.update({
          where: { id: messageId },
          data: { isDeleted: true },
        });

        io.to(`live:${liveId}`).emit('message-deleted', messageId);
      } catch (error) {
        console.error('Message delete error:', error);
      }
    });

    // 연결 해제
    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected:', socket.id);
      
      // 모든 방에서 사용자 제거
      roomUsers.forEach((users, roomKey) => {
        if (users.has(socket.id)) {
          const user = users.get(socket.id);
          users.delete(socket.id);
          
          const viewerCount = users.size;
          
          io.to(roomKey).emit('viewer-count', viewerCount);
          io.to(roomKey).emit('user-left', {
            userName: user.userName,
            viewerCount,
          });
        }
      });
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log('> Socket.io server is running');
    });
});
