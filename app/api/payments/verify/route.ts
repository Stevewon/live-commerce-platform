import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import prisma from '@/lib/prisma';

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || '';

export async function POST(req: NextRequest) {
  try {
    // 인증 확인
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId } = authResult;

    const body = await req.json();
    const { orderId, paymentKey, amount } = body;

    // 유효성 검사
    if (!orderId || !paymentKey || !amount) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다' },
        { status: 400 }
      );
    }

    // 주문 조회
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 본인의 주문인지 확인
    if (order.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 금액 검증
    if (order.total !== amount) {
      return NextResponse.json(
        { success: false, error: '결제 금액이 일치하지 않습니다' },
        { status: 400 }
      );
    }

    // Toss Payments API 결제 승인 요청
    const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentKey,
        orderId: order.orderNumber,
        amount: order.total
      })
    });

    const tossData = await tossResponse.json();

    if (!tossResponse.ok) {
      console.error('Toss Payments verification failed:', tossData);
      
      // 주문 상태를 CANCELLED로 변경하고 재고 복구
      await prisma.$transaction(async (tx) => {
        // 주문 취소
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'CANCELLED' }
        });

        // 재고 복구
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity
              }
            }
          });
        }
      });

      return NextResponse.json(
        { 
          success: false, 
          error: tossData.message || '결제 검증에 실패했습니다',
          code: tossData.code 
        },
        { status: 400 }
      );
    }

    // 결제 성공 - 주문 상태 업데이트
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CONFIRMED',
        paymentMethod: tossData.method,
        paidAt: new Date(tossData.approvedAt)
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      payment: {
        paymentKey: tossData.paymentKey,
        orderId: tossData.orderId,
        orderName: tossData.orderName,
        method: tossData.method,
        totalAmount: tossData.totalAmount,
        approvedAt: tossData.approvedAt,
        receipt: tossData.receipt
      },
      message: '결제가 완료되었습니다'
    });
  } catch (error: any) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '결제 검증 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
