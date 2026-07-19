import { NextRequest, NextResponse } from 'next/server';
import { approveKispgPayment } from '@/lib/kispg';
import { getPrisma } from '@/lib/prisma';

/**
 * POST /api/payments/confirm
 * 
 * KISPG 결제 승인 API (수동 호출용).
 * 일반적으로 /api/payments/kispg/return에서 자동 승인되지만,
 * 필요 시 별도로 승인을 시도할 수 있는 엔드포인트.
 * 
 * Body: { tid, orderId, amount }
 */
export async function POST(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    const { tid, orderId, amount } = await request.json();

    if (!tid || !orderId || !amount) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // KISPG 결제 승인 요청
    const paymentData = await approveKispgPayment({
      tid,
      goodsAmt: amount,
    });

    // DB에서 주문 조회
    const order = await prisma.order.findFirst({
      where: { orderNumber: orderId },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 주문 상태 업데이트
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CONFIRMED',
        paymentMethod: paymentData.payMethod || '신용카드',
        paymentKey: tid,
        paidAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: '결제가 성공적으로 완료되었습니다.',
      payment: paymentData,
    });
  } catch (error) {
    console.error('Payment confirmation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '결제 승인에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
