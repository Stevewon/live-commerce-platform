import { NextRequest, NextResponse } from 'next/server';
import { cancelKispgPayment, normalizeKispgPayMethod } from '@/lib/kispg';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

/**
 * POST /api/payments/cancel
 * 
 * [2026-05-12 v6] 회원 + 비회원 주문 취소 지원
 * - 회원: JWT 인증 + 본인 주문 확인
 * - 비회원: guestOrderToken으로 본인 주문 확인
 * - 관리자: 모든 주문 취소 가능
 * - D1 호환: cancelledAt/refundedAt → ISO string
 * - 재고 복구: batch CASE WHEN (N+1 제거)
 */
export async function POST(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    const body = await request.json();
    const { orderId, cancelReason, guestOrderToken } = body;

    if (!orderId || !cancelReason) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // DB에서 주문 조회 (items 포함 — 재고 복구용)
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 취소 가능 상태 확인
    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      return NextResponse.json(
        { success: false, error: '이미 배송/취소된 주문은 취소할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 권한 확인: 회원 인증 시도
    let userId: string | null = null;
    let userRole: string | null = null;
    const authResult = await verifyAuthToken(request);
    if (!(authResult instanceof NextResponse)) {
      userId = authResult.userId;
      userRole = authResult.role || null;
    }

    // 권한 판별: 관리자 / 본인 회원 / 비회원(guestOrderToken)
    const isAdmin = userRole === 'ADMIN';
    const isOwnerMember = userId && order.userId === userId;
    const isOwnerGuest = !order.userId && guestOrderToken && order.guestOrderToken === guestOrderToken;

    if (!isAdmin && !isOwnerMember && !isOwnerGuest) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다. 비회원은 주문번호와 연락처로 문의해주세요.' },
        { status: 403 }
      );
    }

    const nowIso = new Date().toISOString();
    const updateData: any = {
      status: 'CANCELLED',
      cancelReason,
      cancelledAt: nowIso,
    };

    // KISPG 실결제 취소 (paymentKey에 KISPG tid 저장됨)
    if (order.paymentKey) {
      try {
        await cancelKispgPayment({
          payMethod: normalizeKispgPayMethod(order.paymentMethod),
          tid: order.paymentKey,
          canAmt: order.total,
          canId: userId || 'guest',
          canNm: isOwnerGuest ? '비회원' : '고객',
          canMsg: cancelReason,
        });
        updateData.refundAmount = order.total;
        updateData.refundedAt = nowIso;
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

    // 재고 복구 (batch CASE WHEN — N+1 제거)
    if (order.items && order.items.length > 0) {
      const stockIncrementMap = new Map<string, number>();
      for (const item of order.items) {
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
}
