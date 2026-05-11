import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

/**
 * POST /api/payments/kispg/sync
 *
 * [2026-05-11 v4 안전망]
 * 결제 성공 페이지 진입 시점에 클라이언트가 호출하는 paymentKey 강제 복구 엔드포인트.
 *
 * 목적:
 * - KISPG return 핸들러(POST/GET)가 어떤 이유(네트워크/방화벽/Cloudflare 라우팅 등)로 실패해도
 *   사용자가 /payment/success 페이지에 도달했다는 사실 자체가 결제 인증이 성공했다는 증거이므로,
 *   이 시점에 paymentKey/status/paymentMethod 를 무조건 한 번 더 DB에 박는다.
 * - 이미 CONFIRMED + paymentKey 있는 주문은 idempotent 하게 skip.
 *
 * Body: { orderId, tid, payMethod, appNo?, amount? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId: string = body?.orderId || '';
    const tid: string = body?.tid || '';
    const payMethod: string = body?.payMethod || 'card';
    const appNo: string = body?.appNo || '';

    if (!orderId || !tid) {
      return NextResponse.json({ ok: false, reason: 'orderId/tid 누락' }, { status: 400 });
    }

    const prisma = await getPrisma();

    // 현재 상태 조회
    let before: any = null;
    try {
      const sel: any = await prisma.$queryRawUnsafe(
        'SELECT id, status, paymentKey, paymentMethod FROM "Order" WHERE id = ? LIMIT 1',
        orderId
      );
      before = Array.isArray(sel) ? sel[0] : (sel?.results?.[0] || sel);
    } catch (e: any) {
      console.error('[KISPG Sync] before SELECT 실패:', e?.message || e);
    }

    if (!before) {
      return NextResponse.json({ ok: false, reason: 'order not found', orderId }, { status: 404 });
    }

    // 이미 paymentKey 있으면 skip (idempotent)
    if (before.paymentKey && before.status === 'CONFIRMED') {
      console.log('[KISPG Sync] skip (이미 CONFIRMED + paymentKey 존재):', orderId, before.paymentKey);
      return NextResponse.json({ ok: true, skipped: true, paymentKey: before.paymentKey });
    }

    const paymentMethodKr = payMethodToKorean(payMethod);
    const nowIso = new Date().toISOString();

    // raw SQL UPDATE — 어떤 wrapper quirk 도 우회
    let changes = 0;
    try {
      changes = await prisma.$executeRawUnsafe(
        'UPDATE "Order" SET "status" = ?, "paymentMethod" = ?, "paymentKey" = ?, "paidAt" = ?, "updatedAt" = ? WHERE "id" = ?',
        'CONFIRMED', paymentMethodKr, tid, nowIso, nowIso, orderId
      );
      console.log('[KISPG Sync] UPDATE changes=', changes, 'orderId=', orderId, 'tid=', tid);
    } catch (rawErr: any) {
      console.error('[KISPG Sync] raw SQL 실패:', rawErr?.message || rawErr);
      // 마지막 안전망 — paymentKey 단독
      try {
        changes = await prisma.$executeRawUnsafe(
          'UPDATE "Order" SET "paymentKey" = ?, "updatedAt" = ? WHERE "id" = ?',
          tid, nowIso, orderId
        );
        console.log('[KISPG Sync] paymentKey 단독 changes=', changes);
      } catch (rawErr2: any) {
        console.error('[KISPG Sync] paymentKey 단독 raw 도 실패:', rawErr2?.message || rawErr2);
        return NextResponse.json({ ok: false, reason: rawErr2?.message || 'update failed' }, { status: 500 });
      }
    }

    // 사후 검증
    let after: any = null;
    try {
      const sel2: any = await prisma.$queryRawUnsafe(
        'SELECT id, status, paymentKey, paymentMethod, paidAt FROM "Order" WHERE id = ? LIMIT 1',
        orderId
      );
      after = Array.isArray(sel2) ? sel2[0] : (sel2?.results?.[0] || sel2);
    } catch {}

    console.log('[KISPG Sync] 완료. before=', JSON.stringify(before), 'after=', JSON.stringify(after), 'appNo=', appNo);
    return NextResponse.json({ ok: true, changes, before, after });
  } catch (error: any) {
    console.error('[KISPG Sync] 예외:', error?.message || error);
    return NextResponse.json({ ok: false, reason: error?.message || 'sync error' }, { status: 500 });
  }
}

function payMethodToKorean(method: string): string {
  const map: Record<string, string> = {
    card: '신용카드', CARD: '신용카드',
    bank: '계좌이체', BANK: '계좌이체',
    vacnt: '가상계좌', VACNT: '가상계좌',
    hp: '휴대폰결제', HP: '휴대폰결제',
  };
  return map[method] || method || '신용카드';
}
