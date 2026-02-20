// app/api/partner/lives/[id]/route.ts
// 개별 라이브 관리 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// GET /api/partner/lives/[id] - 라이브 상세
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenResult = await verifyAuthToken(req);
    if (tokenResult instanceof NextResponse) return tokenResult;
    
    const { userId, role } = tokenResult;
    const { id } = await params;
    
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

    // 라이브 조회
    const live = await prisma.liveStream.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            chatMessages: true,
            orders: true,
          },
        },
      },
    });

    if (!live) {
      return NextResponse.json(
        { success: false, error: '라이브를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 본인 라이브인지 확인
    if (live.partnerId !== partner.id) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      live,
    });
  } catch (error: any) {
    console.error('라이브 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '라이브를 불러올 수 없습니다' },
      { status: 500 }
    );
  }
}

// PATCH /api/partner/lives/[id] - 라이브 수정 및 상태 변경
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenResult = await verifyAuthToken(req);
    if (tokenResult instanceof NextResponse) return tokenResult;
    
    const { userId, role } = tokenResult;
    const { id } = await params;
    
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

    // 라이브 조회
    const live = await prisma.liveStream.findUnique({
      where: { id },
    });

    if (!live) {
      return NextResponse.json(
        { success: false, error: '라이브를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 본인 라이브인지 확인
    if (live.partnerId !== partner.id) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const updateData: any = {};

    // 업데이트 가능한 필드
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.thumbnail !== undefined) updateData.thumbnail = body.thumbnail;
    if (body.youtubeUrl !== undefined) {
      updateData.youtubeUrl = body.youtubeUrl;
      updateData.streamUrl = body.youtubeUrl;
    }
    if (body.productIds !== undefined) {
      updateData.productIds = JSON.stringify(body.productIds);
    }
    if (body.scheduledAt !== undefined) {
      updateData.scheduledAt = new Date(body.scheduledAt);
    }
    if (body.specialDiscount !== undefined) {
      updateData.specialDiscount = body.specialDiscount;
    }

    // 상태 변경 처리
    if (body.status !== undefined) {
      const validStatuses = ['SCHEDULED', 'LIVE', 'ENDED'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 상태입니다' },
          { status: 400 }
        );
      }

      updateData.status = body.status;
      
      // LIVE로 변경 시
      if (body.status === 'LIVE' && live.status !== 'LIVE') {
        updateData.isLive = true;
        updateData.startedAt = new Date();
      }
      
      // ENDED로 변경 시
      if (body.status === 'ENDED' && live.status !== 'ENDED') {
        updateData.isLive = false;
        updateData.endedAt = new Date();
      }
    }

    // 라이브 업데이트
    const updatedLive = await prisma.liveStream.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      live: updatedLive,
      message: '라이브가 업데이트되었습니다',
    });
  } catch (error: any) {
    console.error('라이브 업데이트 오류:', error);
    return NextResponse.json(
      { success: false, error: '라이브 업데이트에 실패했습니다' },
      { status: 500 }
    );
  }
}

// DELETE /api/partner/lives/[id] - 라이브 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenResult = await verifyAuthToken(req);
    if (tokenResult instanceof NextResponse) return tokenResult;
    
    const { userId, role } = tokenResult;
    const { id } = await params;
    
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

    // 라이브 조회
    const live = await prisma.liveStream.findUnique({
      where: { id },
    });

    if (!live) {
      return NextResponse.json(
        { success: false, error: '라이브를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 본인 라이브인지 확인
    if (live.partnerId !== partner.id) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      );
    }

    // 진행 중인 라이브는 삭제 불가
    if (live.isLive || live.status === 'LIVE') {
      return NextResponse.json(
        { success: false, error: '진행 중인 라이브는 삭제할 수 없습니다' },
        { status: 400 }
      );
    }

    // 라이브 삭제
    await prisma.liveStream.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '라이브가 삭제되었습니다',
    });
  } catch (error: any) {
    console.error('라이브 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: '라이브 삭제에 실패했습니다' },
      { status: 500 }
    );
  }
}
