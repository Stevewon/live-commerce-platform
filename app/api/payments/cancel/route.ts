import { NextRequest, NextResponse } from 'next/server';
import { cancelKispgPayment } from '@/lib/kispg';
import { getPrisma } from '@/lib/prisma';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  const prisma = await getPrisma();
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

      const updateData: any = {
        status: 'CANCELLED',
        cancelReason,
        cancelledAt: new Date(),
      };

      // KISPG 실결제 취소 (paymentKey에 KISPG tid 저장됨)
      if (order.paymentKey) {
        try {
          const cancelResult = await cancelKispgPayment({
            payMethod: order.paymentMethod === '신용카드' ? 'card' : (order.paymentMethod || 'card'),
            tid: order.paymentKey,
            canAmt: order.total,
            canId: req.user?.userId || 'user',
            canNm: '고객',
            canMsg: cancelReason,
          });
          updateData.refundAmount = order.total;
          updateData.refundedAt = new Date();
        } catch (pgError: any) {
          console.error('KISPG payment cancel failed:', pgError.message);
          // PG 취소 실패해도 주문 취소는 진행 (수동 환불 필요)
        }
      }

      // DB 주문 상태 업데이트
      await prisma.order.update({
        where: { id: orderId },
        data: updateData,
      });

      // 재고 복구
      const orderWithItems = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (orderWithItems?.items) {
        for (const item of orderWithItems.items) {
          await prisma.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

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
