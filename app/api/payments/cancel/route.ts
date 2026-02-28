import { NextRequest, NextResponse } from 'next/server';
import { cancelTossPayment } from '@/lib/toss';
import prisma from '@/lib/prisma';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  return requireAuth(request, async (req: AuthenticatedRequest) => {
    try {
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
      if (!req.user || (order.userId !== req.user.userId && req.user.role !== 'ADMIN')) {
        return NextResponse.json(
          { success: false, error: '권한이 없습니다.' },
          { status: 403 }
        );
      }

      // DB 주문 상태 업데이트
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });

      // 실제 결제 취소 API는 주문에 payment 정보가 있을 경우 호출
      // TODO: Toss Payments API 연동
      // if (order.paymentKey) {
      //   const cancelData = await cancelTossPayment(order.paymentKey, cancelReason);
      // }

      return NextResponse.json({
        success: true,
        message: '주문이 취소되었습니다.',
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
  });
}
