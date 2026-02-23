import { NextRequest, NextResponse } from 'next/server';
import { confirmTossPayment } from '@/lib/toss';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { paymentKey, orderId, amount } = await request.json();

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // Toss Payments API로 결제 승인 요청
    const paymentData = await confirmTossPayment({
      paymentKey,
      orderId,
      amount,
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
        status: 'PAID',
        paymentKey,
        paymentMethod: paymentData.method,
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
