import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getPrisma } from '@/lib/prisma';

/**
 * POST /api/payments/verify
 * 
 * KISPG 전환 후 레거시 호환용.
 * KISPG 결제는 /api/payments/kispg/return에서 승인 처리하므로
 * 이 엔드포인트는 DB 주문 상태만 확인하여 반환한다.
 * 
 * 기존 Toss Payments 연동 코드에서 호출하는 경우에도 동작하도록 유지.
 */
export async function POST(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    const body = await req.json();
    const { orderId, paymentKey, amount } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: '주문 ID가 필요합니다' },
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

    // 회원 주문인 경우 본인 확인
    if (order.userId) {
      const authResult = await verifyAuthToken(req);
      if (!(authResult instanceof NextResponse)) {
        if (order.userId !== authResult.userId) {
          return NextResponse.json(
            { success: false, error: '접근 권한이 없습니다' },
            { status: 403 }
          );
        }
      }
    }

    // KISPG 결제의 경우: return route에서 이미 승인 처리됨 (CONFIRMED 상태)
    // 상태만 확인하여 반환
    if (order.status === 'CONFIRMED' || order.status === 'SHIPPING' || order.status === 'DELIVERED') {
      return NextResponse.json({
        success: true,
        order,
        payment: {
          paymentKey: order.paymentKey || paymentKey || '',
          orderId: order.orderNumber,
          orderName: order.items.map(i => i.product.name).join(', '),
          method: order.paymentMethod || '신용카드',
          totalAmount: order.total,
          approvedAt: order.paidAt?.toISOString() || new Date().toISOString(),
        },
        message: '결제가 완료되었습니다'
      });
    }

    // PENDING 상태인 경우 (아직 결제 미완료)
    if (order.status === 'PENDING') {
      return NextResponse.json(
        { success: false, error: '결제가 아직 완료되지 않았습니다', code: 'PAYMENT_PENDING' },
        { status: 400 }
      );
    }

    // CANCELLED 등 다른 상태
    return NextResponse.json(
      { success: false, error: '결제가 취소되었거나 유효하지 않은 주문입니다', code: order.status },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '결제 검증 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
