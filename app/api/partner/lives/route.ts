// app/api/partner/lives/route.ts
// 파트너 라이브 관리 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// GET /api/partner/lives - 내 라이브 목록
export async function GET(req: NextRequest) {
  try {
    const tokenResult = await verifyAuthToken(req);
    if (tokenResult instanceof NextResponse) return tokenResult;
    
    const { userId, role } = tokenResult;
    
    if (role !== 'PARTNER') {
      return NextResponse.json(
        { success: false, error: '파트너 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 파트너 정보 조회
    const partner = await prisma.partner.findUnique({
      where: { userId },
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: '파트너 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 라이브 목록 조회
    const lives = await prisma.liveStream.findMany({
      where: { partnerId: partner.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            chatMessages: true,
            orders: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      lives,
    });
  } catch (error: any) {
    console.error('라이브 목록 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '라이브 목록을 불러올 수 없습니다' },
      { status: 500 }
    );
  }
}

// POST /api/partner/lives - 라이브 생성
export async function POST(req: NextRequest) {
  try {
    const tokenResult = await verifyAuthToken(req);
    if (tokenResult instanceof NextResponse) return tokenResult;
    
    const { userId, role } = tokenResult;
    
    if (role !== 'PARTNER') {
      return NextResponse.json(
        { success: false, error: '파트너 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 파트너 정보 조회
    const partner = await prisma.partner.findUnique({
      where: { userId },
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: '파트너 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const {
      title,
      description,
      thumbnail,
      youtubeUrl,
      platform = 'youtube',
      productIds,
      scheduledAt,
      specialDiscount,
    } = await req.json();

    // 필수 필드 검증
    if (!title || !youtubeUrl) {
      return NextResponse.json(
        { success: false, error: '제목과 YouTube URL은 필수입니다' },
        { status: 400 }
      );
    }

    // 라이브 생성
    const live = await prisma.liveStream.create({
      data: {
        partnerId: partner.id,
        title,
        description,
        thumbnail,
        streamUrl: youtubeUrl,
        youtubeUrl,
        platform,
        productIds: productIds ? JSON.stringify(productIds) : null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        specialDiscount,
        status: 'SCHEDULED',
        isLive: false,
      },
    });

    return NextResponse.json({
      success: true,
      live,
      message: '라이브가 생성되었습니다',
    });
  } catch (error: any) {
    console.error('라이브 생성 오류:', error);
    return NextResponse.json(
      { success: false, error: '라이브 생성에 실패했습니다' },
      { status: 500 }
    );
  }
}
