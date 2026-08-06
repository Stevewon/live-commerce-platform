import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
// [v1.0.22] KISPG PG 취소 제거 → 잔액 환불로 전환
import { newId, getD1, ensureQtaColumn } from '@/lib/balance';
// [상품 스냅샷] 상품 삭제/변경돼도 주문 상세에 상품명 유지
import { backfillOrderItemSnapshots } from '@/lib/orderItemSnapshot';
// [QRChat 연동] B 회원 QKEY 는 Firebase 실쿠키에서 결제됨 → 취소 시 Firebase 로 되돌림.
import { refundQkeyForQrlive, normWallet, normNick } from '@/lib/qrchat-bridge';
// [공용] 취소/환불 핵심 로직 (중복주문 정리와 동일 로직 공유)
import { refundOrderBalance, recoverOrderQta } from '@/lib/orderRefund';

/* [refactor] refundOrderBalance / recoverOrderQta 는 lib/orderRefund.ts 로 이전.
   아래 구버전 정의 블록 제거됨 — 중복주문 정리(dedupe)와 동일 로직 공유. */
// (refundOrderBalance / recoverOrderQta 는 @/lib/orderRefund 에서 import)



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

    // [QRChat 연동] 취소/환불 시 이 주문 회원이 B 회원(qrchatUid+지갑+닉)인지 판정.
    //   B 회원의 QKEY 는 Firebase 실쿠키에서 결제됐으므로 로컬 대신 Firebase 로 되돌린다.
    let qrchatUser: { uid: string; wallet: string; nick: string } | null = null;
    if ((isCancelling || isRefunding) && order.userId) {
      try {
        const uRows: any = await (await getD1())
          .prepare(`SELECT "qrchatUid","securetQrUrl","nickname","name" FROM "User" WHERE "id" = ? LIMIT 1`)
          .bind(order.userId)
          .all();
        const uRow = (uRows?.results && uRows.results[0]) || (Array.isArray(uRows) ? uRows[0] : null);
        if (uRow) {
          // ⚠️ 큐알쳇 HMAC 서명은 normWallet(trim+lowercase)/normNick(trim) 기준.
          //    지갑을 lowercase 안 하면 서명 불일치로 refund 가 'bad request signature' 거부됨.
          const uid = String(uRow.qrchatUid || '').trim();
          const wallet = normWallet(uRow.securetQrUrl);
          const nick = normNick(uRow.nickname || uRow.name);
          if (uid && wallet && nick) qrchatUser = { uid, wallet, nick };
        }
      } catch (e) {
        console.warn('[관리자취소-환불] B회원 판정 조회 실패(로컬환불로 폴백):', e);
      }
    }

    // [v1.0.22] 재고 복구 + 잔액 환불 + 상태 변경을 하나의 트랜잭션으로 원자 처리
    let refundResult: { refunded: boolean; currency?: 'KRW' | 'QKEY' | 'SPLIT'; amount?: number; qkey?: number; krw?: number; pendingFirebaseQkey?: number } = { refunded: false };

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
          refundReason,
          qrchatUser
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

    // [QRChat 연동] 커밋 후 B 회원 QKEY 를 Firebase 실쿠키로 되돌린다 (멱등: refund:orderId).
    if ((isCancelling || isRefunding) && qrchatUser && (refundResult.pendingFirebaseQkey || 0) > 0) {
      const fbQkey = refundResult.pendingFirebaseQkey as number;
      try {
        const r = await refundQkeyForQrlive({
          uid: qrchatUser.uid,
          wallet: qrchatUser.wallet,
          nick: qrchatUser.nick,
          amountQkey: fbQkey,
          orderId: order.id,
          idemKey: `refund:${order.id}`,
        });
        if (r && r.ok) {
          try {
            await (await getD1())
              .prepare(
                `INSERT INTO "BalanceLedger"
                   ("id","userId","currency","amount","balanceAfter","reason","relatedOrderId","relatedRequestId","createdAt")
                 VALUES (?, ?, 'QKEY', ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)`
              )
              .bind(newId(), order.userId, fbQkey, Number((r as any).newBalance) || 0, refundReason, order.id)
              .run();
          } catch (ledgerErr) {
            console.warn('[관리자취소-환불] Firebase QKEY 원장 기록 실패(무시):', ledgerErr);
          }
        } else {
          console.error('[관리자취소-환불] Firebase QKEY 재적립 실패:', (r as any)?.error);
        }
      } catch (e) {
        console.error('[관리자취소-환불] refundQkeyForQrlive 예외:', e);
      }
    }

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

// DELETE /api/admin/orders/[id] - 주문 영구 삭제 (관리자 전용)
//   ⚠️ 안전장치: 취소/환불된 주문(CANCELLED / REFUNDED)만 삭제 가능.
//     진행 중인 주문(결제/배송 등)은 실수 삭제 방지를 위해 삭제 거부.
//   OrderItem 은 onDelete Cascade 가 없으므로 먼저 삭제 후 Order 삭제(트랜잭션).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = await getPrisma();
  const { id } = await params;
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) return authResult;
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, orderNumber: true, status: true },
    });
    if (!order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 });
    }

    // 취소/환불된 주문만 삭제 허용 (진행 중 주문 보호)
    if (order.status !== 'CANCELLED' && order.status !== 'REFUNDED') {
      return NextResponse.json(
        { error: '취소 또는 환불된 주문만 삭제할 수 있습니다. 먼저 주문을 취소해주세요.', code: 'NOT_CANCELLED' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // OrderItem 먼저 삭제 (Cascade 없음)
      await tx.$executeRawUnsafe(`DELETE FROM "OrderItem" WHERE "orderId" = ?`, id);
      await tx.$executeRawUnsafe(`DELETE FROM "Order" WHERE "id" = ?`, id);
    });

    return NextResponse.json({
      success: true,
      deletedOrderNumber: order.orderNumber,
      message: '주문이 삭제되었습니다',
    });
  } catch (error: any) {
    console.error('Admin order delete error:', error);
    return NextResponse.json({ error: '주문 삭제 실패: ' + (error?.message || '') }, { status: 500 });
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

    // [상품 스냅샷] 컬럼 보장 + 기존 주문 백필 (멱등)
    try { await backfillOrderItemSnapshots(await getD1()); } catch { /* 실패해도 진행 */ }

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

    // 주문 시점 스냅샷 우선 (상품 삭제/변경돼도 상품명 유지)
    for (const item of ((order as any).items || [])) {
      const snapName = item.productName || '';
      if (!item.product) {
        item.product = { id: item.productId || '', name: snapName || '주문 상품', slug: '', price: item.price || 0, images: null };
      } else {
        item.product.name = item.product.name || snapName || '주문 상품';
      }
    }

    return NextResponse.json({ order });
  } catch (error: any) {
    console.error('Admin order detail error:', error);
    return NextResponse.json({ error: '주문 상세 조회 실패' }, { status: 500 });
  }
}
