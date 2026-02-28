import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // 인증 확인
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태값입니다' },
        { status: 400 }
      );
    }

    // 정산 업데이트
    const settlement = await prisma.settlement.update({
      where: { id: id },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? new Date() : undefined,
        processedAt: new Date()
      },
      include: {
        partner: {
          select: {
            storeName: true,
            user: {
              select: {
                name: true,
                email: true,
                phone: true
              }
            }
          }
        }
      }
    });

    // TODO: 정산 완료 시 파트너에게 이메일/SMS 알림 전송

    return NextResponse.json({
      success: true,
      message: `정산이 ${status === 'COMPLETED' ? '완료' : '업데이트'}되었습니다`,
      data: settlement
    });

  } catch (error) {
    console.error('Update settlement error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '정산 업데이트 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
