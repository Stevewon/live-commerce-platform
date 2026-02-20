// app/api/lives/[id]/chat/route.ts
// 라이브 채팅 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// 욕설 필터 (간단한 버전)
const BAD_WORDS = ['욕설1', '욕설2', '비속어']; // 실제로는 더 확장 필요

function filterBadWords(message: string): string {
  let filtered = message;
  BAD_WORDS.forEach((word) => {
    const regex = new RegExp(word, 'gi');
    filtered = filtered.replace(regex, '***');
  });
  return filtered;
}

// GET /api/lives/[id]/chat - 채팅 메시지 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: liveStreamId } = await params;
    const { searchParams } = new URL(req.url);
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const afterId = searchParams.get('afterId'); // 이 ID 이후 메시지만 조회 (폴링용)
    const beforeId = searchParams.get('beforeId'); // 이 ID 이전 메시지 조회 (페이지네이션용)

    // 라이브 존재 확인
    const live = await prisma.liveStream.findUnique({
      where: { id: liveStreamId },
    });

    if (!live) {
      return NextResponse.json(
        { success: false, error: '라이브를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 필터 조건
    const where: any = {
      liveStreamId,
      isDeleted: false,
    };

    if (afterId) {
      where.id = { gt: afterId };
    } else if (beforeId) {
      where.id = { lt: beforeId };
    }

    // 채팅 메시지 조회
    const messages = await prisma.liveChat.findMany({
      where,
      orderBy: { createdAt: afterId ? 'asc' : 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    // afterId 조회는 오름차순이므로 다시 정렬
    if (afterId) {
      messages.reverse();
    }

    return NextResponse.json({
      success: true,
      messages,
      hasMore: messages.length === limit,
    });
  } catch (error: any) {
    console.error('채팅 메시지 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '채팅 메시지를 불러올 수 없습니다' },
      { status: 500 }
    );
  }
}

// POST /api/lives/[id]/chat - 채팅 메시지 전송
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenResult = await verifyAuthToken(req);
    if (tokenResult instanceof NextResponse) return tokenResult;
    
    const { userId, name } = tokenResult;
    const { id: liveStreamId } = await params;

    // 라이브 존재 확인
    const live = await prisma.liveStream.findUnique({
      where: { id: liveStreamId },
    });

    if (!live) {
      return NextResponse.json(
        { success: false, error: '라이브를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const { message } = await req.json();

    // 메시지 검증
    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: '메시지를 입력해주세요' },
        { status: 400 }
      );
    }

    if (message.length > 500) {
      return NextResponse.json(
        { success: false, error: '메시지는 500자를 초과할 수 없습니다' },
        { status: 400 }
      );
    }

    // 욕설 필터링
    const filteredMessage = filterBadWords(message.trim());

    // 채팅 메시지 생성
    const chatMessage = await prisma.liveChat.create({
      data: {
        liveStreamId,
        userId,
        message: filteredMessage,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: chatMessage,
    });
  } catch (error: any) {
    console.error('채팅 메시지 전송 오류:', error);
    return NextResponse.json(
      { success: false, error: '메시지 전송에 실패했습니다' },
      { status: 500 }
    );
  }
}

// DELETE /api/lives/[id]/chat - 채팅 메시지 삭제 (파트너만)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenResult = await verifyAuthToken(req);
    if (tokenResult instanceof NextResponse) return tokenResult;
    
    const { userId, role } = tokenResult;
    const { id: liveStreamId } = await params;
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'messageId가 필요합니다' },
        { status: 400 }
      );
    }

    // 라이브 조회
    const live = await prisma.liveStream.findUnique({
      where: { id: liveStreamId },
    });

    if (!live) {
      return NextResponse.json(
        { success: false, error: '라이브를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 메시지 조회
    const message = await prisma.liveChat.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: '메시지를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 권한 확인: 본인 또는 파트너(라이브 주인) 또는 관리자
    const partner = await prisma.partner.findUnique({
      where: { userId },
    });

    const isOwner = message.userId === userId;
    const isLiveOwner = partner && partner.id === live.partnerId;
    const isAdmin = role === 'ADMIN';

    if (!isOwner && !isLiveOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      );
    }

    // 메시지 삭제 (soft delete)
    await prisma.liveChat.update({
      where: { id: messageId },
      data: { isDeleted: true },
    });

    return NextResponse.json({
      success: true,
      message: '메시지가 삭제되었습니다',
    });
  } catch (error: any) {
    console.error('채팅 메시지 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: '메시지 삭제에 실패했습니다' },
      { status: 500 }
    );
  }
}
