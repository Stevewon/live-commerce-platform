import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken } from '@/lib/auth/middleware'
import { getPrisma } from '@/lib/prisma';
import { cancelKispgPayment, normalizeKispgPayMethod } from '@/lib/kispg';

// 주문 상세 조회 (GET) — 회원(token) + 비회원(guestOrderToken) 지원
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  try {
    const { id: orderId } = await context.params;

    // 인증: 회원 토큰 시도 (실패해도 비회원 경로 가능)
    let userId: string | null = null;
    let userRole: string | null = null;
    const authResult = await verifyAuthToken(req);
    if (!(authResult instanceof NextResponse)) {
      userId = authResult.userId;
      userRole = authResult.role || null;
    }

    // 비회원 토큰: header 또는 query param
    const guestOrderToken =
      req.headers.get('x-guest-order-token') ||
      new URL(req.url).searchParams.get('guestOrderToken') ||
      '';

    // 주문 조회
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 권한 확인: 관리자 / 본인(회원) / 본인(비회원 guestOrderToken 일치)
    const isAdmin = userRole === 'ADMIN';
    const isOwnerMember = userId && order.userId === userId;
    const isOwnerGuest = !order.userId && guestOrderToken && order.guestOrderToken === guestOrderToken;

    if (!isAdmin && !isOwnerMember && !isOwnerGuest) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      order
    })
  } catch (error: any) {
    console.error('Get order detail error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

// 주문 취소 (PATCH)
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  try {
    const { id } = await context.params;
    // 인증 확인
    const authResult = await verifyAuthToken(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { userId } = authResult

    const { id: orderId } = await context.params
    const { status } = await req.json()

    // 주문 조회
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 본인의 주문인지 확인
    if (order.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다' },
        { status: 403 }
      )
    }

    // 취소 가능한 상태인지 확인
    if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
      return NextResponse.json(
        { success: false, error: '이미 배송이 시작되어 취소할 수 없습니다' },
        { status: 400 }
      )
    }

    // 주문 상태 업데이트
    const updateData: any = { status }

    // 취소 시 KISPG 결제 취소 및 재고 복구
    if (status === 'CANCELLED') {
      updateData.cancelledAt = new Date().toISOString()
      
      // KISPG 실결제 취소 (paymentKey에 KISPG tid 저장)
      if (order.paymentKey) {
        try {
          await cancelKispgPayment({
            payMethod: normalizeKispgPayMethod(order.paymentMethod),
            tid: order.paymentKey,
            canAmt: order.total,
            canId: userId,
            canNm: '고객',
            canMsg: '고객 요청에 의한 주문 취소',
          })
          updateData.refundAmount = order.total
          updateData.refundedAt = new Date().toISOString()
        } catch (pgError: any) {
          console.error('KISPG payment cancel failed:', pgError.message)
          // PG 취소 실패해도 주문 취소는 진행 (수동 환불 필요)
        }
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    })

    // 취소 시 재고 복구 (batch CASE WHEN — N+1 제거)
    if (status === 'CANCELLED' && updatedOrder.items.length > 0) {
      const stockIncrementMap = new Map<string, number>();
      for (const item of updatedOrder.items) {
        const qty = Number(item.quantity);
        if (!item.productId || !Number.isFinite(qty) || qty <= 0) continue;
        stockIncrementMap.set(
          item.productId,
          (stockIncrementMap.get(item.productId) || 0) + qty
        );
      }
      if (stockIncrementMap.size > 0) {
        const productIds = Array.from(stockIncrementMap.keys());
        const caseParts: string[] = [];
        const params: any[] = [];
        for (const [pid, qty] of stockIncrementMap.entries()) {
          caseParts.push(`WHEN ? THEN stock + ?`);
          params.push(pid, qty);
        }
        const placeholders = productIds.map(() => '?').join(',');
        const sql = `UPDATE "Product" SET stock = CASE id ${caseParts.join(' ')} ELSE stock END, "updatedAt" = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`;
        await prisma.$executeRawUnsafe(sql, ...params, ...productIds);
      }
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: status === 'CANCELLED' ? '주문이 취소되었습니다' : '주문 상태가 변경되었습니다'
    })
  } catch (error: any) {
    console.error('Update order error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
