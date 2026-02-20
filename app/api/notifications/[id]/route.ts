// app/api/notifications/[id]/route.ts
// 개별 알림 읽음 처리 & 삭제 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// PATCH /api/notifications/[id] - 알림 읽음 처리
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenResult = await verifyAuthToken(req);
    if (tokenResult instanceof NextResponse) return tokenResult;
    
    const { userId } = tokenResult;
    const { id } = await params;
    
    // 알림 조회
    const notification = await prisma.notification.findUnique({
      where: { id },
    });
    
    if (!notification) {
      return NextResponse.json(
        { success: false, error: '알림을 찾을 수 없습니다' },
        { status: 404 }
      );
    }
    
    // 본인 알림인지 확인
    if (notification.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      );
    }
    
    // 읽음 처리
    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    
    return NextResponse.json({
      success: true,
      notification: updated,
      message: '알림을 읽음 처리했습니다',
    });
  } catch (error: any) {
    console.error('알림 읽음 처리 오류:', error);
    return NextResponse.json(
      { success: false, error: '알림 처리에 실패했습니다' },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications/[id] - 알림 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenResult = await verifyAuthToken(req);
    if (tokenResult instanceof NextResponse) return tokenResult;
    
    const { userId } = tokenResult;
    const { id } = await params;
    
    // 알림 조회
    const notification = await prisma.notification.findUnique({
      where: { id },
    });
    
    if (!notification) {
      return NextResponse.json(
        { success: false, error: '알림을 찾을 수 없습니다' },
        { status: 404 }
      );
    }
    
    // 본인 알림인지 확인
    if (notification.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      );
    }
    
    // 알림 삭제
    await prisma.notification.delete({
      where: { id },
    });
    
    return NextResponse.json({
      success: true,
      message: '알림이 삭제되었습니다',
    });
  } catch (error: any) {
    console.error('알림 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: '알림 삭제에 실패했습니다' },
      { status: 500 }
    );
  }
}
