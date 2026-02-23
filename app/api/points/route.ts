import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import prisma from '@/lib/prisma';

// 포인트 내역 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // 포인트 잔액 조회
    const user = await prisma.user.findUnique({
      where: { id: authResult.user.id },
      select: { points: true }
    });

    // 포인트 내역 조회
    const [history, total] = await Promise.all([
      prisma.pointHistory.findMany({
        where: { userId: authResult.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.pointHistory.count({
        where: { userId: authResult.user.id }
      })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        balance: user?.points || 0,
        history,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get points error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '포인트 조회 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// 포인트 지급/차감 (POST) - 관리자 전용
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    // 관리자 권한 확인
    if (authResult.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, amount, type, description, orderId } = body;

    if (!userId || !amount || !type || !description) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다' },
        { status: 400 }
      );
    }

    if (!['EARN', 'USE', 'REFUND', 'EXPIRE', 'ADMIN_ADJUST'].includes(type)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 포인트 타입입니다' },
        { status: 400 }
      );
    }

    // 포인트 차감인 경우 잔액 확인
    if (['USE', 'EXPIRE'].includes(type)) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { points: true }
      });

      if (!user || user.points < amount) {
        return NextResponse.json(
          { success: false, error: '포인트 잔액이 부족합니다' },
          { status: 400 }
        );
      }
    }

    // 트랜잭션으로 포인트 업데이트 및 내역 생성
    const result = await prisma.$transaction(async (tx) => {
      // 포인트 증감
      const increment = ['EARN', 'REFUND', 'ADMIN_ADJUST'].includes(type) && amount > 0;
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          points: {
            [increment ? 'increment' : 'decrement']: Math.abs(amount)
          }
        },
        select: { points: true }
      });

      // 포인트 내역 생성
      const history = await tx.pointHistory.create({
        data: {
          userId,
          amount: increment ? amount : -amount,
          type,
          description,
          balance: user.points,
          orderId: orderId || null
        }
      });

      return { user, history };
    });

    return NextResponse.json({
      success: true,
      message: '포인트가 처리되었습니다',
      data: {
        balance: result.user.points,
        history: result.history
      }
    });

  } catch (error) {
    console.error('Process points error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '포인트 처리 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
