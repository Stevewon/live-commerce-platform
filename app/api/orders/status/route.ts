import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

/**
 * GET /api/orders/status?orderId=xxx
 * 
 * 결제 후 주문 상태를 확인하는 경량 API
 * - 인증 불필요 (결제 실패 페이지에서 호출하므로)
 * - 최소한의 정보만 반환 (보안: 주소/연락처 등 민감 정보 제외)
 * - 회원/비회원 모두 지원
 * 
 * [2026-04-30] 결제 성공인데 실패 페이지로 이동하는 버그 수정 시 추가
 * → 실패 페이지에서 이 API로 주문 상태를 재확인하여, 실제로 결제 완료된 경우 성공 페이지로 자동 이동
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId가 필요합니다' },
        { status: 400 }
      );
    }

    const prisma = await getPrisma();
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        paymentMethod: true,
        paymentKey: true,
        paidAt: true,
        createdAt: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        paymentMethod: order.paymentMethod,
        isPaid: ['CONFIRMED', 'SHIPPING', 'DELIVERED'].includes(order.status),
        paidAt: order.paidAt,
      },
    });
  } catch (error: any) {
    console.error('[Order Status] 조회 실패:', error.message);
    return NextResponse.json(
      { success: false, error: '주문 상태 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
