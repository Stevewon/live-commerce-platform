import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken } from '@/lib/auth/middleware'
import { getPrisma } from '@/lib/prisma';
// [v1.0.22] KISPG PG 취소 제거 → 잔액 환불로 전환
import { QKEY_TO_KRW, newId, getD1, ensureQtaColumn } from '@/lib/balance';
// [상품 스냅샷] 상품 삭제/변경돼도 주문 상세에 상품명 유지
import { backfillOrderItemSnapshots } from '@/lib/orderItemSnapshot';
// [QRChat 연동] B 회원(origin=QRCHAT) QKEY 는 Firebase 실쿠키에서 결제됨 →
//   취소 시에도 Firebase 실쿠키로 되돌려줘야 함(로컬 D1 잔액 환불 아님).
import { refundQkeyForQrlive, normWallet, normNick } from '@/lib/qrchat-bridge';

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

    // [상품 스냅샷] 백필 (멱등) + 스냅샷 우선 정규화 (상품 삭제/변경돼도 상품명 유지)
    try { await backfillOrderItemSnapshots(await getD1()); } catch { /* 실패해도 진행 */ }
    for (const item of ((order as any).items || [])) {
      const snapName = item.productName || '';
      const snapThumb = item.productThumbnail || '';
      if (!item.product) {
        item.product = { id: item.productId || '', name: snapName || '주문 상품', slug: '', thumbnail: snapThumb || '', category: { name: '' } };
      } else {
        item.product.name = item.product.name || snapName || '주문 상품';
        item.product.thumbnail = item.product.thumbnail || snapThumb || '';
        if (!item.product.category) item.product.category = { name: '' };
      }
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

    // [QRChat 연동] 이 주문의 회원이 B 회원(qrchatUid+지갑+닉 존재)인지 판정.
    //   → B 회원의 QKEY 는 로컬 D1 이 아니라 Firebase 실쿠키에서 결제됐으므로
    //     취소 시 로컬 환불을 건너뛰고 커밋 후 refundQkeyForQrlive 로 되돌린다.
    let qkeyUser: { uid?: string; wallet?: string; nick?: string } = {};
    let usesFirebaseQkey = false;
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
        if (uid && wallet && nick) {
          qkeyUser = { uid, wallet, nick };
          usesFirebaseQkey = true;
        }
      }
    } catch (e) {
      console.warn('[취소-환불] B회원 판정 조회 실패(로컬환불로 폴백):', e);
    }

    // [v1.0.22] 재고 복구 + 잔액 환불 + 상태 변경을 하나의 트랜잭션으로 원자 처리
    // [병행결제] 환불도 쿠키/현금을 각각 되돌려준다 (SPLIT_BALANCE 지원).
    let refundResult: { refunded: boolean; currency?: 'KRW' | 'QKEY' | 'SPLIT'; amount?: number; qkey?: number; krw?: number } = { refunded: false };
    // 커밋 후 Firebase 로 되돌릴 쿠키 개수 (B 회원 전용). 0 이면 Firebase 환불 없음.
    let firebaseRefundQkey = 0;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1) 잔액 환불 (잔액 결제 & 미환불 주문만, 멱등)
      if (isCancelling) {
        const method = order.paymentMethod || '';
        const isKrw = method === 'KRW_BALANCE';
        const isQkey = method === 'QKEY_BALANCE';
        const isSplit = method === 'SPLIT_BALANCE';

        // 결제수단별 환불할 통화·금액 산정.
        //  - 병행결제: 주문에 기록된 paidQkey / paidKrw 를 우선 사용 (없으면 total 기준 폴백).
        const refundQkey = isQkey
          ? Math.ceil(order.total / QKEY_TO_KRW)
          : isSplit
            ? (Number((order as any).paidQkey) || 0)
            : 0;
        const refundKrw = isKrw
          ? order.total
          : isSplit
            ? (Number((order as any).paidKrw) || 0)
            : 0;

        // 통화 1개 환불 헬퍼 (User 잔액 +금액, BalanceLedger 안전문구 기록)
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
            newId(), order.userId, currency, amount, afterBal, '주문 취소 환불', order.id
          );
        };

        if ((isKrw || isQkey || isSplit) && order.userId && !order.refundedAt && (refundQkey > 0 || refundKrw > 0)) {
          // [QRChat 연동] B 회원의 QKEY 는 로컬이 아닌 Firebase 실쿠키에서 결제됨.
          //   → 로컬 qkeyBalance 환불을 건너뛰고, 커밋 후 Firebase 로 되돌린다.
          //   (현금 KRW 는 로컬 잔액이므로 그대로 로컬 환불.)
          if (usesFirebaseQkey && refundQkey > 0) {
            firebaseRefundQkey = refundQkey; // 커밋 후 Firebase 재적립 대상
          } else {
            await refundOne('qkeyBalance', 'QKEY', refundQkey);
          }
          await refundOne('krwBalance', 'KRW', refundKrw);
          updateData.refundAmount = order.total;
          updateData.refundedAt = new Date().toISOString();
          if (isSplit) {
            refundResult = { refunded: true, currency: 'SPLIT', amount: order.total, qkey: refundQkey, krw: refundKrw };
          } else {
            refundResult = {
              refunded: true,
              currency: isKrw ? 'KRW' : 'QKEY',
              amount: isKrw ? refundKrw : refundQkey,
            };
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

    // [QRChat 연동] 커밋 후 B 회원 QKEY 를 Firebase 실쿠키로 되돌린다 (멱등: refund:orderId).
    //   외부 HTTP 는 D1 트랜잭션 내부에서 부를 수 없으므로 커밋 후 처리.
    //   실패해도 주문 취소 자체는 유지하되, 로그를 남기고 응답에 표시.
    if (isCancelling && usesFirebaseQkey && firebaseRefundQkey > 0) {
      try {
        const r = await refundQkeyForQrlive({
          uid: qkeyUser.uid as string,
          wallet: qkeyUser.wallet as string,
          nick: qkeyUser.nick as string,
          amountQkey: firebaseRefundQkey,
          orderId: order.id,
          idemKey: `refund:${order.id}`, // 결제 멱등키(order.id)와 분리
        });
        if (r && r.ok) {
          // 로컬 원장에 표시용 기록 (로컬 잔액은 건드리지 않음)
          try {
            await (await getD1())
              .prepare(
                `INSERT INTO "BalanceLedger"
                   ("id","userId","currency","amount","balanceAfter","reason","relatedOrderId","relatedRequestId","createdAt")
                 VALUES (?, ?, 'QKEY', ?, ?, '주문 취소 환불', ?, NULL, CURRENT_TIMESTAMP)`
              )
              .bind(newId(), order.userId, firebaseRefundQkey, Number((r as any).newBalance) || 0, order.id)
              .run();
          } catch (ledgerErr) {
            console.warn('[취소-환불] Firebase QKEY 원장 기록 실패(무시):', ledgerErr);
          }
          refundResult = { refunded: true, currency: 'QKEY', amount: firebaseRefundQkey };
        } else {
          console.error('[취소-환불] Firebase QKEY 재적립 실패:', (r as any)?.error);
          // 주문은 이미 취소됨. 쿠키 환불만 실패 → 관리자 알림용 로그.
        }
      } catch (e) {
        console.error('[취소-환불] refundQkeyForQrlive 예외:', e);
      }
    }

    let message = status === 'CANCELLED' ? '주문이 취소되었습니다' : '주문 상태가 변경되었습니다';
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
