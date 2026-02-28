import { NextRequest, NextResponse } from 'next/server';
import { cancelTossPayment } from '@/lib/toss';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    const { orderId, cancelReason } = await request.json();

    if (!orderId || !cancelReason) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // DB에서 주문 조회
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 본인 주문 확인 (관리자는 모든 주문 취소 가능)
    if (order.userId !== authResult.user.id && authResult.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 결제 키가 없으면 DB만 업데이트
    if (!order.paymentKey) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });

      return NextResponse.json({
        success: true,
        message: '주문이 취소되었습니다.',
      });
    }

    // Toss Payments API로 결제 취소 요청
    const cancelData = await cancelTossPayment(order.paymentKey, cancelReason);

    // DB 주문 상태 업데이트
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({
      success: true,
      message: '결제가 취소되었습니다.',
      cancel: cancelData,
    });
  } catch (error) {
    console.error('Payment cancel error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '결제 취소에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
