// app/api/lives/route.ts
// 공개 라이브 목록 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/lives - 라이브 목록 (공개)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const status = searchParams.get('status') || 'LIVE'; // LIVE, SCHEDULED, ENDED, ALL
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 필터 조건
    const where: any = {};
    
    if (status !== 'ALL') {
      where.status = status;
    }

    // 라이브 목록 조회
    const lives = await prisma.liveStream.findMany({
      where,
      orderBy: [
        { isLive: 'desc' }, // 진행 중인 라이브 우선
        { scheduledAt: 'desc' }, // 스케줄 최신순
        { createdAt: 'desc' }, // 생성 최신순
      ],
      take: limit,
      skip: offset,
      include: {
        partner: {
          select: {
            id: true,
            storeName: true,
            storeSlug: true,
            logo: true,
          },
        },
        _count: {
          select: {
            chatMessages: true,
            orders: true,
          },
        },
      },
    });

    // 총 개수
    const total = await prisma.liveStream.count({ where });

    return NextResponse.json({
      success: true,
      lives,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error('라이브 목록 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '라이브 목록을 불러올 수 없습니다' },
      { status: 500 }
    );
  }
}
