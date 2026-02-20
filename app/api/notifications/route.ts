// app/api/notifications/route.ts
// 알림 목록 조회 & 생성 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// GET /api/notifications - 사용자 알림 목록 조회
export async function GET(req: NextRequest) {
  try {
    const tokenResult = await verifyAuthToken(req);
    if (tokenResult instanceof NextResponse) return tokenResult;
    
    const { userId } = tokenResult;
    const { searchParams } = new URL(req.url);
    
    const isRead = searchParams.get('isRead');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // 필터 조건
    const where: any = { userId };
    if (isRead !== null && isRead !== 'all') {
      where.isRead = isRead === 'true';
    }
    
    // 알림 조회
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);
    
    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    console.error('알림 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '알림을 불러올 수 없습니다' },
      { status: 500 }
    );
  }
}

// POST /api/notifications - 알림 생성 (시스템/관리자용)
export async function POST(req: NextRequest) {
  try {
    const tokenResult = await verifyAuthToken(req);
    if (tokenResult instanceof NextResponse) return tokenResult;
    
    const { role } = tokenResult;
    
    // 관리자만 수동 알림 생성 가능
    if (role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      );
    }
    
    const { userId, type, title, content, link } = await req.json();
    
    // 필수 필드 검증
    if (!userId || !type || !title || !content) {
      return NextResponse.json(
        { success: false, error: '필수 정보를 입력해주세요' },
        { status: 400 }
      );
    }
    
    // 알림 생성
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        content,
        link,
      },
    });
    
    return NextResponse.json({
      success: true,
      notification,
      message: '알림이 생성되었습니다',
    });
  } catch (error: any) {
    console.error('알림 생성 오류:', error);
    return NextResponse.json(
      { success: false, error: '알림 생성에 실패했습니다' },
      { status: 500 }
    );
  }
}
