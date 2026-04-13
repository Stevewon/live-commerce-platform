import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { cancelKispgPayment } from '@/lib/kispg';



// PATCH /api/admin/orders/[id] - 주문 상태 변경
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  const { id } = await params;
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const body = await req.json();
    const { status, trackingCompany, trackingNumber } = body;

    // 유효한 상태 확인
    const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: '유효하지 않은 상태입니다' }, { status: 400 });
    }

    // 주문 존재 확인
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 });
    }

    // 취소 시 재고 복구
    if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
      for (const item of order.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }
    }

    // 업데이트 데이터 구성
    const updateData: any = { status };

    // 배송 추적 정보 추가
    if (trackingCompany !== undefined) updateData.trackingCompany = trackingCompany;
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;

    // 상태별 자동 시각 기록
    if (status === 'SHIPPING' && order.status !== 'SHIPPING') {
      updateData.shippedAt = new Date();
    }
    if (status === 'DELIVERED' && order.status !== 'DELIVERED') {
      updateData.deliveredAt = new Date();
    }
    if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
      updateData.cancelledAt = new Date();
      
      // KISPG 실결제 취소 (paymentKey에 KISPG tid 저장)
      if (order.paymentKey) {
        try {
          await cancelKispgPayment({
            payMethod: order.paymentMethod === '신용카드' ? 'card' : (order.paymentMethod || 'card'),
            tid: order.paymentKey,
            canAmt: order.total,
            canId: 'admin',
            canNm: '관리자',
            canMsg: body.cancelReason || '관리자에 의한 주문 취소',
          });
          updateData.refundAmount = order.total;
          updateData.refundedAt = new Date();
        } catch (pgError: any) {
          console.error('KISPG payment cancel failed (admin):', pgError.message);
          // PG 취소 실패해도 주문 취소는 진행 (수동 환불 필요)
        }
      }
    }

    // REFUNDED 상태 처리
    if (status === 'REFUNDED' && order.status !== 'REFUNDED') {
      updateData.refundedAt = new Date();
      
      // KISPG 실결제 취소 (환불)
      if (order.paymentKey) {
        try {
          await cancelKispgPayment({
            payMethod: order.paymentMethod === '신용카드' ? 'card' : (order.paymentMethod || 'card'),
            tid: order.paymentKey,
            canAmt: order.total,
            canId: 'admin',
            canNm: '관리자',
            canMsg: body.cancelReason || '관리자에 의한 환불 처리',
          });
          updateData.refundAmount = order.total;
        } catch (pgError: any) {
          console.error('KISPG payment refund failed (admin):', pgError.message);
        }
      }
    }

    // 주문 상태 업데이트
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        partner: {
          select: {
            storeName: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                price: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: '주문 상태가 변경되었습니다',
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error('Admin order update error:', error);
    return NextResponse.json({ error: '주문 상태 변경 실패' }, { status: 500 });
  }
}

// GET /api/admin/orders/[id] - 주문 상세 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  const { id } = await params;
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        partner: {
          select: {
            id: true,
            storeName: true,
            storeSlug: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                images: true,
              },
            },
          },
        },
        coupon: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error: any) {
    console.error('Admin order detail error:', error);
    return NextResponse.json({ error: '주문 상세 조회 실패' }, { status: 500 });
  }
}
