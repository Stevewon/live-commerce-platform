import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { inquireKispgPayment, classifyInquireResult } from '@/lib/kispg';

/**
 * GET/POST /api/cron/auto-resolve-stuck-orders
 *
 * [2026-05-12 옵션 1] KISPG 거래조회 자동 복구 cron
 *
 * 동작:
 * 1) PENDING + 진입마커 + paymentKey 없거나 placeholder + 5분~24시간 사이 stuck 주문 조회
 * 2) 각 주문에 대해 KISPG `/v2/order` 거래조회 호출
 * 3) classifyInquireResult 결과에 따라 자동 DB 업데이트:
 *    - CONFIRMED → paymentKey/status/paidAt 자동 저장 (사장님 관여 0)
 *    - CANCELLED → status=CANCELLED 자동 반영
 *    - PENDING (가상계좌) → 유지
 *    - UNKNOWN → 유지 (어드민 위젯에서 사장님 수동 확인)
 *
 * 트리거:
 * - GitHub Actions schedule (별도 워크플로 detect-stuck-orders 와 같은 주기 권장)
 * - 사장님 영구 룰: cron 트리거 단 1개씩 분리
 *
 * 인증: CRON_SECRET (cleanup-pending-orders / detect-stuck-orders 와 동일 패턴)
 *
 * 사장님 사고 케이스(지나/hero zina ORD-1778558607255):
 *   DB: PENDING + paymentKey=MANUAL-RECOVERY-xxx (placeholder)
 *   → 본 cron 실행 시 KISPG 측에 ordNo=ORD-1778558607255, goodsAmt=3010 으로 조회
 *   → 응답 tid=실제TID, trxStatus='승인' → 자동 CONFIRMED + 실제 tid 저장
 *   → 사장님 KISPG 콘솔 안 보고도 자동 복구 완료
 */
export async function GET(req: NextRequest) {
  return handleCron(req);
}
export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  // 1) 외부 호출 차단
  const expectedSecret = process.env.CRON_SECRET || '';
  const url = new URL(req.url);
  const providedSecret =
    req.headers.get('x-cron-secret') ||
    url.searchParams.get('secret') ||
    '';
  const isWorkersCron =
    req.headers.get('cf-cron') === 'true' ||
    req.headers.get('x-cf-cron') === 'true';
  if (expectedSecret && !isWorkersCron && providedSecret !== expectedSecret) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const startedAt = Date.now();
  const prisma = await getPrisma();

  // 2) stuck 주문 조회
  // 조건: PENDING + 진입마커 + (paymentKey IS NULL OR placeholder) + 5분~24시간
  // placeholder = 'MANUAL-RECOVERY-' 로 시작하는 paymentKey (사장님 사고 복구 마커)
  const FIVE_MIN_MS = 5 * 60 * 1000;
  const TWENTY_FOUR_HR_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const upperIso = new Date(now - FIVE_MIN_MS).toISOString();
  const lowerIso = new Date(now - TWENTY_FOUR_HR_MS).toISOString();

  const ENTRY_MARKERS = ['결제대기', '결제창진입', '신용카드'];
  const placeholders = ENTRY_MARKERS.map(() => '?').join(',');

  let stuckOrders: any[] = [];
  try {
    const sql = `
      SELECT id, orderNumber, status, paymentMethod, paymentKey, total, createdAt
      FROM "Order"
      WHERE (
        (status = 'PENDING' AND paymentMethod IN (${placeholders})
         AND (paymentKey IS NULL OR paymentKey = ''))
        OR
        (paymentKey LIKE 'MANUAL-RECOVERY-%')
      )
      AND createdAt > ?
      AND createdAt < ?
      ORDER BY createdAt ASC
      LIMIT 50
    `;
    stuckOrders = (await prisma.$queryRawUnsafe(
      sql,
      ...ENTRY_MARKERS,
      lowerIso,
      upperIso
    )) as any[];
  } catch (e: any) {
    console.error('[cron/auto-resolve-stuck-orders] 조회 실패:', e?.message || e);
    return NextResponse.json(
      { success: false, error: 'DB 조회 실패', detail: e?.message || String(e) },
      { status: 500 }
    );
  }

  console.log(
    '[cron/auto-resolve-stuck-orders] stuck 후보:', stuckOrders.length, '건'
  );

  let resolved = 0;          // 자동 복구 성공 (CONFIRMED 또는 CANCELLED 자동 반영)
  let stillPending = 0;      // 가상계좌 입금대기 (정상)
  let unknown = 0;           // KISPG 측에서도 거래 없음 (인증만 끝나고 승인 실패)
  let failed = 0;            // KISPG 조회 자체 실패 (방화벽/네트워크)
  const details: any[] = [];

  for (const order of stuckOrders) {
    const goodsAmt = Number(order.total);
    if (!Number.isFinite(goodsAmt) || goodsAmt <= 0) {
      failed++;
      details.push({ orderNumber: order.orderNumber, reason: '주문 금액 비정상', total: order.total });
      continue;
    }

    let inquireRes: any;
    try {
      inquireRes = await inquireKispgPayment({
        ordNo: order.orderNumber,
        goodsAmt,
      });
    } catch (e: any) {
      failed++;
      const errMsg = e?.message || String(e);
      console.error(
        '[cron/auto-resolve-stuck-orders] KISPG 조회 실패:',
        order.orderNumber, errMsg
      );
      details.push({ orderNumber: order.orderNumber, kind: 'INQUIRE_FAILED', error: errMsg });
      continue;
    }

    const classified = classifyInquireResult(inquireRes);
    const nowIso = new Date().toISOString();

    if (classified.kind === 'CONFIRMED' && classified.tid) {
      // 이미 동일 tid + CONFIRMED 면 skip
      if (order.paymentKey === classified.tid && order.status === 'CONFIRMED') {
        details.push({ orderNumber: order.orderNumber, kind: 'CONFIRMED', action: 'SKIP_IDEMPOTENT' });
        continue;
      }
      const paymentMethodKr = payMethodToKorean(classified.payMethod || 'card');
      const paidAtIso = appDtmToIso(classified.appDtm) || nowIso;
      try {
        const changes = await prisma.$executeRawUnsafe(
          `UPDATE "Order"
           SET status = ?, paymentMethod = ?, paymentKey = ?, paidAt = ?, updatedAt = ?
           WHERE id = ?`,
          'CONFIRMED', paymentMethodKr, classified.tid, paidAtIso, nowIso, order.id
        );
        resolved++;
        console.log(
          '[cron/auto-resolve-stuck-orders] ✅ CONFIRMED 자동 복구:',
          order.orderNumber, 'tid=', classified.tid, 'changes=', changes
        );
        details.push({
          orderNumber: order.orderNumber,
          kind: 'CONFIRMED',
          action: 'AUTO_RESOLVED',
          tid: classified.tid,
          appNo: classified.appNo,
          paidAt: paidAtIso,
        });
      } catch (e: any) {
        failed++;
        console.error(
          '[cron/auto-resolve-stuck-orders] UPDATE 실패:',
          order.orderNumber, e?.message || e
        );
        details.push({
          orderNumber: order.orderNumber,
          kind: 'CONFIRMED',
          action: 'UPDATE_FAILED',
          error: e?.message || String(e),
        });
      }
    } else if (classified.kind === 'CANCELLED' && classified.tid) {
      if (order.status === 'CANCELLED') {
        details.push({ orderNumber: order.orderNumber, kind: 'CANCELLED', action: 'SKIP_IDEMPOTENT' });
        continue;
      }
      const paymentMethodKr = payMethodToKorean(classified.payMethod || 'card');
      try {
        const changes = await prisma.$executeRawUnsafe(
          `UPDATE "Order"
           SET status = ?, paymentMethod = ?, paymentKey = ?, cancelledAt = ?, cancelReason = ?, updatedAt = ?
           WHERE id = ?`,
          'CANCELLED', paymentMethodKr, classified.tid, nowIso, 'KISPG 측 취소 확인 (자동 동기화)', nowIso, order.id
        );
        resolved++;
        console.log(
          '[cron/auto-resolve-stuck-orders] ✅ CANCELLED 자동 동기화:',
          order.orderNumber, 'changes=', changes
        );
        details.push({
          orderNumber: order.orderNumber,
          kind: 'CANCELLED',
          action: 'AUTO_SYNCED',
          tid: classified.tid,
        });
      } catch (e: any) {
        failed++;
        details.push({
          orderNumber: order.orderNumber,
          kind: 'CANCELLED',
          action: 'UPDATE_FAILED',
          error: e?.message || String(e),
        });
      }
    } else if (classified.kind === 'PENDING') {
      stillPending++;
      details.push({
        orderNumber: order.orderNumber,
        kind: 'PENDING_VACNT',
        action: 'NO_CHANGE',
        tid: classified.tid,
      });
    } else {
      unknown++;
      details.push({
        orderNumber: order.orderNumber,
        kind: 'UNKNOWN',
        action: 'NO_CHANGE',
        resultCd: inquireRes?.resultCd,
        resultMsg: inquireRes?.resultMsg,
      });
    }
  }

  const elapsedMs = Date.now() - startedAt;
  const summary = {
    success: true,
    scannedAt: new Date(now).toISOString(),
    candidates: stuckOrders.length,
    resolved,
    stillPending,
    unknown,
    failed,
    elapsedMs,
    details,
  };
  console.log('[cron/auto-resolve-stuck-orders] summary:', JSON.stringify(summary));
  return NextResponse.json(summary);
}

function payMethodToKorean(method: string): string {
  const m = String(method || '').toLowerCase();
  const map: Record<string, string> = {
    card: '신용카드',
    bank: '계좌이체',
    vacnt: '가상계좌',
    hp: '휴대폰결제',
  };
  return map[m] || method || '신용카드';
}

function appDtmToIso(appDtm?: string): string | null {
  if (!appDtm || typeof appDtm !== 'string') return null;
  const clean = appDtm.replace(/\D/g, '');
  if (clean.length !== 14) return null;
  const y = clean.slice(0, 4);
  const mo = clean.slice(4, 6);
  const d = clean.slice(6, 8);
  const h = clean.slice(8, 10);
  const mi = clean.slice(10, 12);
  const s = clean.slice(12, 14);
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}+09:00`;
  const parsed = new Date(iso);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
