import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken } from '@/lib/auth/middleware'
import { getPrisma } from '@/lib/prisma';
// [v1.0.22] KISPG PG 취소 제거 → 잔액 환불로 전환
import { QKEY_TO_KRW, newId, getD1, ensureQtaColumn } from '@/lib/balance';

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
    const isCancelling = status === 'CANCELLED'
    if (isCancelling) updateData.cancelledAt = new Date().toISOString()

    // QTA 적립 컬럼 자동 보정 (멱등)
    if (isCancelling) {
      try { await ensureQtaColumn(await getD1()); } catch { /* 무시 */ }
    }

    // [v1.0.22] 재고 복구 + 잔액 환불 + 상태 변경을 하나의 트랜잭션으로 원자 처리
    let refundResult: { refunded: boolean; currency?: 'KRW' | 'QKEY'; amount?: number } = { refunded: false };

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1) 잔액 환불 (KRW_BALANCE / QKEY_BALANCE 결제 & 미환불 주문만, 멱등)
      if (isCancelling) {
        const method = order.paymentMethod || '';
        const isKrw = method === 'KRW_BALANCE';
        const isQkey = method === 'QKEY_BALANCE';
        if ((isKrw || isQkey) && order.userId && !order.refundedAt) {
          const currency: 'KRW' | 'QKEY' = isKrw ? 'KRW' : 'QKEY';
          const column = isKrw ? 'krwBalance' : 'qkeyBalance';
          const refundAmount = isKrw ? order.total : Math.ceil(order.total / QKEY_TO_KRW);
          if (refundAmount > 0) {
            const balRows: any = await tx.$queryRawUnsafe(
              `SELECT "${column}" AS bal FROM "User" WHERE "id" = ? LIMIT 1`,
              order.userId
            );
            const balRow = Array.isArray(balRows) ? balRows[0] : balRows;
            const afterBal = (Number(balRow?.bal) || 0) + refundAmount;
            await tx.$executeRawUnsafe(
              `UPDATE "User" SET "${column}" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?`,
              afterBal, order.userId
            );
            await tx.$executeRawUnsafe(
              `INSERT INTO "BalanceLedger"
                 ("id","userId","currency","amount","balanceAfter","reason","relatedOrderId","relatedRequestId","createdAt")
               VALUES (?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)`,
              newId(), order.userId, currency, refundAmount, afterBal, '주문 취소 환불', order.id
            );
            updateData.refundAmount = order.total;
            updateData.refundedAt = new Date().toISOString();
            refundResult = { refunded: true, currency, amount: refundAmount };
          }
        }
      }

      // 1-2) [QTA 적립 회수] 취소 시 이 주문으로 적립됐던 QTA 자동 회수 (멱등)
      //  ── 적립분(양수) 합계 - 이미 회수한 분(음수) 합계 = 남은 회수 대상.
      //     남은 회수 대상이 양수일 때만 회수하며, 사용자 QTA 잔액이 음수가 되지 않도록 가드.
      //     회수 실패가 취소/환불 처리를 막지 않도록 방어적으로 처리.
      if (isCancelling && order.userId) {
       try {
        const qtaSumRows: any = await tx.$queryRawUnsafe(
          `SELECT
             COALESCE(SUM(CASE WHEN "amount" > 0 THEN "amount" ELSE 0 END), 0) AS earned,
             COALESCE(SUM(CASE WHEN "amount" < 0 THEN -"amount" ELSE 0 END), 0) AS reversed
           FROM "BalanceLedger"
           WHERE "relatedOrderId" = ? AND "currency" = 'QTA'`,
          order.id
        );
        const qtaSumRow = Array.isArray(qtaSumRows) ? qtaSumRows[0] : qtaSumRows;
        const earnedQta = Number(qtaSumRow?.earned) || 0;
        const reversedQta = Number(qtaSumRow?.reversed) || 0;
        const recoverTarget = earnedQta - reversedQta; // 아직 회수 안 된 적립분

        if (recoverTarget > 0) {
          const qtaBalRows: any = await tx.$queryRawUnsafe(
            `SELECT "qtaBalance" AS bal FROM "User" WHERE "id" = ? LIMIT 1`,
            order.userId
          );
          const qtaBalRow = Array.isArray(qtaBalRows) ? qtaBalRows[0] : qtaBalRows;
          const curQta = Number(qtaBalRow?.bal) || 0;
          // 잔액이 부족하면 있는 만큼만 회수 (음수 방지)
          const recoverAmount = Math.min(recoverTarget, curQta);
          if (recoverAmount > 0) {
            const afterQta = curQta - recoverAmount;
            await tx.$executeRawUnsafe(
              `UPDATE "User" SET "qtaBalance" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?`,
              afterQta, order.userId
            );
            await tx.$executeRawUnsafe(
              `INSERT INTO "BalanceLedger"
                 ("id","userId","currency","amount","balanceAfter","reason","relatedOrderId","relatedRequestId","createdAt")
               VALUES (?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)`,
              newId(), order.userId, 'QTA', -recoverAmount, afterQta, '구매 적립 취소', order.id
            );
          }
        }
       } catch (qtaErr: any) {
         console.warn('[QTA 적립 회수 실패(무시)]', String(qtaErr?.message || qtaErr || ''));
       }
      }

      // 2) 상태 변경
      const updated = await tx.order.update({
        where: { id: orderId },
        data: updateData,
        include: { items: { include: { product: true } } },
      });

      // 3) 취소 시 재고 복구 (batch CASE WHEN — N+1 제거)
      if (isCancelling && updated.items.length > 0) {
        const stockIncrementMap = new Map<string, number>();
        for (const item of updated.items) {
          const qty = Number(item.quantity);
          if (!item.productId || !Number.isFinite(qty) || qty <= 0) continue;
          stockIncrementMap.set(item.productId, (stockIncrementMap.get(item.productId) || 0) + qty);
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
          await tx.$executeRawUnsafe(sql, ...params, ...productIds);
        }
      }

      return updated;
    });

    let message = status === 'CANCELLED' ? '주문이 취소되었습니다' : '주문 상태가 변경되었습니다';
    if (refundResult.refunded) {
      const amtLabel = refundResult.currency === 'KRW'
        ? `₩${(refundResult.amount || 0).toLocaleString()}`
        : `${(refundResult.amount || 0).toLocaleString()} QKEY`;
      message = `주문이 취소되고 ${amtLabel}이(가) 환불되었습니다`;
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      refund: refundResult.refunded ? { currency: refundResult.currency, amount: refundResult.amount } : null,
      message,
    })
  } catch (error: any) {
    console.error('Update order error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
