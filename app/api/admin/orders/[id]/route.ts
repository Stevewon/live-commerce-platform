import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
// [v1.0.22] KISPG PG 취소 제거 → 잔액 환불로 전환
import { QKEY_TO_KRW, newId, getD1, ensureQtaColumn } from '@/lib/balance';

// [v1.0.22] 주문 취소/환불 시 결제했던 잔액을 원자적으로 환불 (중복 방지)
// - paymentMethod 가 KRW_BALANCE / QKEY_BALANCE / SPLIT_BALANCE 인 주문만 환불
// - order.refundedAt 이 이미 있으면 재환불하지 않음 (멱등)
// - Prisma 트랜잭션 tx 컨텍스트 내부에서 raw 로 처리하여 원자성 보장
// - [병행결제] SPLIT_BALANCE 는 주문에 기록된 paidQkey/paidKrw 를 각각 되돌려준다.
async function refundOrderBalance(
  tx: any,
  order: { id: string; userId: string | null; paymentMethod: string | null; total: number; refundedAt: any; paidQkey?: number; paidKrw?: number },
  reason: string
): Promise<{ refunded: boolean; currency?: 'KRW' | 'QKEY' | 'SPLIT'; amount?: number; qkey?: number; krw?: number }> {
  const method = order.paymentMethod || '';
  const isKrw = method === 'KRW_BALANCE';
  const isQkey = method === 'QKEY_BALANCE';
  const isSplit = method === 'SPLIT_BALANCE';

  // 잔액 결제가 아니거나, 회원이 아니거나, 이미 환불된 경우 → 스킵
  if ((!isKrw && !isQkey && !isSplit) || !order.userId || order.refundedAt) {
    return { refunded: false };
  }

  // 환불할 통화·금액 산정 (결제 시 규칙과 동일)
  const refundQkey = isQkey
    ? Math.ceil(order.total / QKEY_TO_KRW)
    : isSplit
      ? (Number(order.paidQkey) || 0)
      : 0;
  const refundKrw = isKrw
    ? order.total
    : isSplit
      ? (Number(order.paidKrw) || 0)
      : 0;
  if (refundQkey <= 0 && refundKrw <= 0) return { refunded: false };

  // 통화 1개 환불 헬퍼
  const refundOne = async (column: 'krwBalance' | 'qkeyBalance', currency: 'KRW' | 'QKEY', amount: number) => {
    if (amount <= 0) return;
    const balRows: any = await tx.$queryRawUnsafe(
      `SELECT "${column}" AS bal FROM "User" WHERE "id" = ? LIMIT 1`,
      order.userId
    );
    const balRow = Array.isArray(balRows) ? balRows[0] : balRows;
    const afterBal = (Number(balRow?.bal) || 0) + amount;
    await tx.$executeRawUnsafe(
      `UPDATE "User" SET "${column}" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?`,
      afterBal, order.userId
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO "BalanceLedger"
         ("id","userId","currency","amount","balanceAfter","reason","relatedOrderId","relatedRequestId","createdAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)`,
      newId(), order.userId, currency, amount /* 양수 = 환불 */, afterBal, reason, order.id
    );
  };

  await refundOne('qkeyBalance', 'QKEY', refundQkey);
  await refundOne('krwBalance', 'KRW', refundKrw);

  if (isSplit) {
    return { refunded: true, currency: 'SPLIT', amount: order.total, qkey: refundQkey, krw: refundKrw };
  }
  return {
    refunded: true,
    currency: isKrw ? 'KRW' : 'QKEY',
    amount: isKrw ? refundKrw : refundQkey,
  };
}

// [QTA 적립 회수] 취소/환불 시 해당 주문으로 적립된 QTA 를 자동 회수 (멱등)
// - 적립분(양수) 합계 - 이미 회수한 분(음수) 합계 = 남은 회수 대상
// - 사용자 QTA 잔액이 음수가 되지 않도록 가드
async function recoverOrderQta(
  tx: any,
  order: { id: string; userId: string | null },
): Promise<{ recovered: boolean; amount?: number }> {
  if (!order.userId) return { recovered: false };

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
  const recoverTarget = earnedQta - reversedQta;
  if (recoverTarget <= 0) return { recovered: false };

  const qtaBalRows: any = await tx.$queryRawUnsafe(
    `SELECT "qtaBalance" AS bal FROM "User" WHERE "id" = ? LIMIT 1`,
    order.userId
  );
  const qtaBalRow = Array.isArray(qtaBalRows) ? qtaBalRows[0] : qtaBalRows;
  const curQta = Number(qtaBalRow?.bal) || 0;
  const recoverAmount = Math.min(recoverTarget, curQta); // 음수 방지
  if (recoverAmount <= 0) return { recovered: false };

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

  return { recovered: true, amount: recoverAmount };
}



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
    const { status, trackingCompany, trackingNumber, paymentKey: manualPaymentKey, paymentMethod: manualPaymentMethod } = body;

    // 결제 정보 수동 등록 (status 없이 paymentKey만 보낼 수 있음)
    if (!status && (manualPaymentKey || manualPaymentMethod)) {
      const updatePaymentData: any = {};
      if (manualPaymentKey) updatePaymentData.paymentKey = manualPaymentKey;
      if (manualPaymentMethod) updatePaymentData.paymentMethod = manualPaymentMethod;
      
      const updatedOrder = await prisma.order.update({
        where: { id },
        data: updatePaymentData,
        include: {
          user: { select: { name: true, email: true } },
          partner: { select: { storeName: true } },
          items: { include: { product: { select: { name: true, price: true } } } },
        },
      });
      return NextResponse.json({
        success: true,
        message: '결제 정보가 업데이트되었습니다',
        order: updatedOrder,
      });
    }

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

    // 업데이트 데이터 구성
    const updateData: any = { status };

    // 배송 추적 정보 추가
    if (trackingCompany !== undefined) updateData.trackingCompany = trackingCompany;
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;

    // 상태별 자동 시각 기록
    if (status === 'SHIPPING' && order.status !== 'SHIPPING') {
      updateData.shippedAt = new Date().toISOString();
    }
    if (status === 'DELIVERED' && order.status !== 'DELIVERED') {
      updateData.deliveredAt = new Date().toISOString();
    }

    // [v1.0.22] 취소/환불 판단
    const isCancelling = status === 'CANCELLED' && order.status !== 'CANCELLED';
    const isRefunding = status === 'REFUNDED' && order.status !== 'REFUNDED';
    const willRestock = isCancelling; // 취소 시에만 재고 복구
    const refundReason = isCancelling ? '주문 취소 환불' : '주문 환불';

    if (isCancelling) updateData.cancelledAt = new Date().toISOString();

    // QTA 적립 컬럼 자동 보정 (멱등)
    if (isCancelling || isRefunding) {
      try { await ensureQtaColumn(await getD1()); } catch { /* 무시 */ }
    }

    // [v1.0.22] 재고 복구 + 잔액 환불 + 상태 변경을 하나의 트랜잭션으로 원자 처리
    let refundResult: { refunded: boolean; currency?: 'KRW' | 'QKEY' | 'SPLIT'; amount?: number; qkey?: number; krw?: number } = { refunded: false };

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1) 취소 시 재고 복구 (batch CASE WHEN — N+1 제거)
      if (willRestock && order.items.length > 0) {
        const stockMap = new Map<string, number>();
        for (const item of order.items) {
          stockMap.set(item.productId, (stockMap.get(item.productId) || 0) + item.quantity);
        }
        const ids = Array.from(stockMap.keys());
        const caseParts = ids.map(pid => `WHEN '${pid}' THEN stock + ${stockMap.get(pid)}`).join(' ');
        const inList = ids.map(pid => `'${pid}'`).join(',');
        await tx.$executeRawUnsafe(
          `UPDATE "Product" SET stock = CASE id ${caseParts} ELSE stock END, "updatedAt" = CURRENT_TIMESTAMP WHERE id IN (${inList})`
        );
      }

      // 2) 잔액 환불 (KRW_BALANCE / QKEY_BALANCE 결제 & 미환불 주문만)
      if (isCancelling || isRefunding) {
        refundResult = await refundOrderBalance(
          tx,
          {
            id: order.id,
            userId: order.userId,
            paymentMethod: order.paymentMethod,
            total: order.total,
            refundedAt: order.refundedAt,
            paidQkey: (order as any).paidQkey,
            paidKrw: (order as any).paidKrw,
          },
          refundReason
        );
        if (refundResult.refunded) {
          updateData.refundedAt = new Date().toISOString();
          updateData.refundAmount = order.total; // KRW 기준 환불 금액 기록
        }

        // [QTA 적립 회수] 취소/환불 시 적립됐던 QTA 자동 회수 (멱등, 잔액결제 여부 무관)
        try {
          await recoverOrderQta(tx, { id: order.id, userId: order.userId });
        } catch (qtaErr: any) {
          console.warn('[QTA 적립 회수 실패(무시)]', String(qtaErr?.message || qtaErr || ''));
        }
      }

      // 3) 주문 상태 업데이트
      return await tx.order.update({
        where: { id },
        data: updateData,
        include: {
          user: { select: { name: true, email: true } },
          partner: { select: { storeName: true } },
          items: { include: { product: { select: { name: true, price: true } } } },
        },
      });
    });

    const responseData: any = {
      success: true,
      order: updatedOrder,
    };

    if (refundResult.refunded) {
      let amtLabel: string;
      if (refundResult.currency === 'SPLIT') {
        const parts: string[] = [];
        if ((refundResult.qkey || 0) > 0) parts.push(`${(refundResult.qkey || 0).toLocaleString()} 쿠키`);
        if ((refundResult.krw || 0) > 0) parts.push(`₩${(refundResult.krw || 0).toLocaleString()}`);
        amtLabel = parts.join(' + ');
      } else if (refundResult.currency === 'KRW') {
        amtLabel = `₩${(refundResult.amount || 0).toLocaleString()}`;
      } else {
        amtLabel = `${(refundResult.amount || 0).toLocaleString()} 쿠키`;
      }
      responseData.message = `주문 ${isCancelling ? '취소' : '환불'} 및 잔액 환불(${amtLabel})이 완료되었습니다`;
      responseData.refund = { currency: refundResult.currency, amount: refundResult.amount, qkey: refundResult.qkey, krw: refundResult.krw };
    } else if ((isCancelling || isRefunding) && order.refundedAt) {
      responseData.message = '주문 상태가 변경되었습니다 (이미 환불 처리된 주문)';
    } else {
      responseData.message = '주문 상태가 변경되었습니다';
    }

    return NextResponse.json(responseData);
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
