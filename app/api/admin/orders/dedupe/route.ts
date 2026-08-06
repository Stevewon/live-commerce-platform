import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1, ensureQtaColumn } from '@/lib/balance';
import {
  refundOrderBalance,
  recoverOrderQta,
  resolveQrchatUserForOrder,
  refundFirebaseQkeyAfterCommit,
  RefundResult,
} from '@/lib/orderRefund';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────
// POST /api/admin/orders/dedupe  — 중복 주문 일괄 정리 (관리자 전용)
//   같은 회원이 "같은 상품구성 + 같은 총액" 으로 만든 주문이 여러 건이면,
//   → 가장 마지막(최신) 1건만 남기고 나머지는 전부 취소 + 환불 + 재고복구.
//   (사장님 지시: "1건 마지막 남기고 전부 날려! 다른 회원에게도 남기지마!")
//
//   Body:
//     { dryRun?: boolean,   // true 면 실제 취소 없이 무엇을 지울지만 리포트 (기본 true)
//       userId?: string }   // 특정 회원만 정리 (생략 시 전체)
//   ※ 시간창(windowSec) 제거: 같은 회원 + 같은 상품 + 같은 금액이면 시간 상관없이 묶음.
//
//   안전장치:
//     - dryRun 기본값 true → 실수로 지우지 않음. 실제 실행은 { "dryRun": false } 명시 필요.
//     - 이미 CANCELLED/REFUNDED 인 주문은 대상에서 제외.
//     - 환불은 refundedAt 기준 멱등 (재실행해도 이중 환불 없음).
// ─────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) return authResult;
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* 빈 바디 허용 */ }
    const dryRun = body?.dryRun !== false; // 기본 true (안전)
    const windowSec = Math.max(30, Math.min(86400, Number(body?.windowSec) || 600));
    const onlyUserId: string | null = body?.userId ? String(body.userId) : null;

    try { await ensureQtaColumn(await getD1()); } catch { /* 무시 */ }

    // 살아있는(취소/환불 안 된) 주문만 대상 — 회원 주문만(userId 필수)
    const where: any = {
      userId: onlyUserId ? onlyUserId : { not: null },
      status: { in: ['PENDING', 'CONFIRMED', 'PAID', 'PROCESSING', 'SHIPPING', 'DELIVERED'] },
    };

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        items: { select: { productId: true, variantId: true, quantity: true } },
      },
    });

    // 상품구성 서명 (productId:variantId:qty 정렬)
    const buildSig = (items: Array<{ productId: string; variantId: string | null; quantity: number }>) =>
      items
        .map((r) => `${r.productId || ''}:${r.variantId || ''}:${Number(r.quantity) || 0}`)
        .sort()
        .join('|');

    // (userId + total + 상품구성) 으로 그룹핑
    const groups = new Map<string, Array<{ id: string; orderNumber: string; createdAt: Date; total: number; userId: string | null }>>();
    for (const o of orders) {
      const sig = `${o.userId}#${o.total}#${buildSig(o.items as any)}`;
      if (!groups.has(sig)) groups.set(sig, []);
      groups.get(sig)!.push({
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: new Date(o.createdAt as any),
        total: o.total,
        userId: o.userId,
      });
    }

    // 중복 후보: 같은 그룹(회원+상품+금액)에 2건 이상 있으면 전부 중복 처리
    type Cluster = { keep: string; cancel: Array<{ id: string; orderNumber: string }>; userId: string; total: number; count: number };
    const clusters: Cluster[] = [];

    // ★ 사장님 지시: 같은 회원 + 같은 상품 + 같은 금액이면 "시간 상관없이"
    //   마지막(최신) 1건만 남기고 나머지 전부 취소.
    //   (기존엔 windowSec 시간창으로 묶어서 16분 차이 나는 주문이 안 묶이는 버그가 있었음 → 시간창 제거)
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const sorted = [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const keep = sorted[sorted.length - 1]; // 마지막(최신) 1건만 남김
      const cancel = sorted.slice(0, sorted.length - 1);
      clusters.push({
        keep: keep.orderNumber,
        cancel: cancel.map((c) => ({ id: c.id, orderNumber: c.orderNumber })),
        userId: String(keep.userId),
        total: keep.total,
        count: sorted.length,
      });
    }

    const cancelIds = clusters.flatMap((c) => c.cancel.map((x) => x.id));

    // ── dryRun: 실제 취소 없이 리포트만 ──
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        windowSec,
        groupsScanned: groups.size,
        duplicateClusters: clusters.length,
        ordersToCancel: cancelIds.length,
        detail: clusters,
        message: `중복 클러스터 ${clusters.length}건 발견 · 취소 대상 ${cancelIds.length}건 (dryRun — 실제 취소 안 함). 실행하려면 {"dryRun": false} 로 다시 호출.`,
      });
    }

    // ── 실제 실행: 취소 대상 주문을 하나씩 취소+환불 ──
    const results: Array<{ orderNumber: string; refunded: boolean; refund?: any; error?: string }> = [];
    for (const cluster of clusters) {
      for (const target of cluster.cancel) {
        try {
          const order = await prisma.order.findUnique({
            where: { id: target.id },
            include: { items: { select: { productId: true, quantity: true } } },
          });
          if (!order || order.status === 'CANCELLED' || order.status === 'REFUNDED') {
            results.push({ orderNumber: target.orderNumber, refunded: false, error: 'already-cancelled-or-missing' });
            continue;
          }

          const qrchatUser = await resolveQrchatUserForOrder(order.userId);
          let refundResult: RefundResult = { refunded: false };

          await prisma.$transaction(async (tx) => {
            // 1) 재고 복구
            if (order.items.length > 0) {
              const stockMap = new Map<string, number>();
              for (const it of order.items) stockMap.set(it.productId, (stockMap.get(it.productId) || 0) + it.quantity);
              const ids = Array.from(stockMap.keys());
              const caseParts = ids.map((pid) => `WHEN '${pid}' THEN stock + ${stockMap.get(pid)}`).join(' ');
              const inList = ids.map((pid) => `'${pid}'`).join(',');
              await tx.$executeRawUnsafe(
                `UPDATE "Product" SET stock = CASE id ${caseParts} ELSE stock END, "updatedAt" = CURRENT_TIMESTAMP WHERE id IN (${inList})`
              );
            }

            // 2) 잔액 환불 (KRW/QKEY/SPLIT)
            refundResult = await refundOrderBalance(
              tx,
              {
                id: order.id,
                userId: order.userId,
                paymentMethod: order.paymentMethod,
                total: order.total,
                refundedAt: (order as any).refundedAt,
                paidQkey: (order as any).paidQkey,
                paidKrw: (order as any).paidKrw,
              },
              '중복 주문 취소 환불',
              qrchatUser
            );

            // 3) QTA 적립 회수
            try { await recoverOrderQta(tx, { id: order.id, userId: order.userId }); }
            catch (e: any) { console.warn('[dedupe] QTA 회수 실패(무시):', String(e?.message || e)); }

            // 4) 상태 CANCELLED
            const upd: any = { status: 'CANCELLED', cancelledAt: new Date().toISOString() };
            if (refundResult.refunded) {
              upd.refundedAt = new Date().toISOString();
              upd.refundAmount = order.total;
            }
            await tx.order.update({ where: { id: order.id }, data: upd });
          });

          // 5) 커밋 후 B회원 Firebase 쿠키 재적립
          if (qrchatUser && (refundResult.pendingFirebaseQkey || 0) > 0) {
            await refundFirebaseQkeyAfterCommit(
              { id: order.id, userId: order.userId },
              qrchatUser,
              refundResult.pendingFirebaseQkey as number,
              '중복 주문 취소 환불'
            );
          }

          results.push({
            orderNumber: target.orderNumber,
            refunded: refundResult.refunded,
            refund: refundResult.refunded
              ? { currency: refundResult.currency, amount: refundResult.amount, qkey: refundResult.qkey, krw: refundResult.krw }
              : undefined,
          });
        } catch (e: any) {
          console.error('[dedupe] 주문 취소 실패:', target.orderNumber, e);
          results.push({ orderNumber: target.orderNumber, refunded: false, error: String(e?.message || e) });
        }
      }
    }

    const cancelledOk = results.filter((r) => !r.error).length;
    const refundedOk = results.filter((r) => r.refunded).length;

    return NextResponse.json({
      success: true,
      dryRun: false,
      windowSec,
      duplicateClusters: clusters.length,
      ordersCancelled: cancelledOk,
      ordersRefunded: refundedOk,
      failed: results.filter((r) => r.error),
      detail: clusters,
      results,
      message: `중복 주문 정리 완료 · 취소 ${cancelledOk}건 / 환불 ${refundedOk}건 (각 그룹 마지막 1건은 보존).`,
    });
  } catch (error: any) {
    console.error('Admin dedupe error:', error);
    return NextResponse.json({ error: '중복 주문 정리 실패: ' + (error?.message || '') }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/orders/dedupe  — 취소/환불된 주문 "전체" 일괄 삭제 (관리자 전용)
//   현재 페이지가 아니라 DB 전체에서 status IN (CANCELLED, REFUNDED) 인 주문을
//   모두 찾아 OrderItem → Order 순으로 삭제한다.
//   (사장님 지시: "취소된거 왜 일괄 삭제기능이 없냐고!!!!!!!")
//
//   Body (선택):
//     { dryRun?: boolean }  // true 면 삭제하지 않고 몇 건이 지워질지만 리포트 (기본 false)
//
//   ※ 삭제는 취소/환불 완료 주문에 한함. 살아있는 주문(결제/배송 등)은 절대 건드리지 않음.
//   ※ OrderItem 은 onDelete Cascade 가 없으므로 반드시 OrderItem 먼저 삭제.
// ─────────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) return authResult;
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* 빈 바디 허용 */ }
    const dryRun = body?.dryRun === true; // 기본 false (버튼은 명시적으로 실행)

    // DB 전체에서 취소/환불된 주문만 조회 (페이지 무관)
    const targets = await prisma.order.findMany({
      where: { status: { in: ['CANCELLED', 'REFUNDED'] } },
      select: { id: true, orderNumber: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        ordersToDelete: targets.length,
        detail: targets.map((t) => ({ orderNumber: t.orderNumber, status: t.status })),
        message: `삭제 예정: 취소/환불 주문 ${targets.length}건.`,
      });
    }

    if (targets.length === 0) {
      return NextResponse.json({
        success: true,
        dryRun: false,
        ordersDeleted: 0,
        message: '삭제할 취소/환불 주문이 없습니다.',
      });
    }

    const ids = targets.map((t) => t.id);
    // 대량 삭제: OrderItem 먼저(자식) → Order(부모). raw SQL 로 한 번에 처리.
    const placeholders = ids.map(() => '?').join(',');
    let deleted = 0;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `DELETE FROM "OrderItem" WHERE "orderId" IN (${placeholders})`,
        ...ids,
      );
      const res: any = await tx.$executeRawUnsafe(
        `DELETE FROM "Order" WHERE "id" IN (${placeholders})`,
        ...ids,
      );
      deleted = typeof res === 'number' ? res : ids.length;
    });

    return NextResponse.json({
      success: true,
      dryRun: false,
      ordersDeleted: deleted || ids.length,
      deletedOrderNumbers: targets.map((t) => t.orderNumber),
      message: `취소/환불 주문 ${deleted || ids.length}건을 모두 삭제했습니다.`,
    });
  } catch (error: any) {
    console.error('Admin bulk-delete cancelled error:', error);
    return NextResponse.json({ error: '취소주문 일괄삭제 실패: ' + (error?.message || '') }, { status: 500 });
  }
}
