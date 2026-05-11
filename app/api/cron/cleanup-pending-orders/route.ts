import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

/**
 * GET/POST /api/cron/cleanup-pending-orders
 *
 * [2026-05-11 MED 3 패치] PENDING 30분 자동 취소 + 재고 복구
 *
 * 배경:
 * - /api/orders POST 시점에 재고를 즉시 DECREMENT 한다.
 * - 사용자가 KISPG 결제창을 닫거나(X) 시간초과되면 /api/payments/kispg/return 이
 *   호출되지 않아 → 주문이 PENDING 으로 영원히 남고 재고가 묶인다.
 * - 이 cron 이 30분 이상 PENDING 주문을 정리하여 재고를 복구한다.
 *
 * 트리거:
 * - Cloudflare Workers Scheduled Trigger ("triggers.crons" in wrangler.jsonc)
 *   - 사장님 영구 룰: cron 트리거는 단 1개만 (Eggplant 의 "이중 cron 금지" 룰
 *     본 프로젝트(QRLive)에도 동일 적용 — Workers cron 1개 / GitHub Actions cron 0개)
 * - cron 실행 시 Workers 가 GET /api/cron/cleanup-pending-orders 호출
 *
 * 인증:
 * - Workers cron 호출은 internal 이므로 별도 인증 불필요 (Cloudflare가 직접 트리거)
 * - 외부 수동 호출 방지를 위해 CRON_SECRET 환경변수 일치 시에만 통과
 * - 헤더: x-cron-secret 또는 ?secret=... 쿼리스트링
 *
 * 안전장치:
 * - 이미 CONFIRMED/SHIPPING/DELIVERED 인 주문은 절대 손대지 않음 (status 재확인)
 * - 이미 CANCELLED 인 주문도 건너뜀
 * - paymentKey(tid) 가 있으면 결제 승인 가능성 → 보존 (관리자 수동 확인)
 *   ※ tid 있는 PENDING 은 결제는 성공했지만 DB 업데이트 실패한 케이스일 수 있음
 * - 30분 cutoff: KISPG 인증창 + 결제 + return route 처리 충분 시간 확보
 * - 한 번에 최대 100건만 처리 (D1 쿼리 폭주 방지)
 */
export async function GET(req: NextRequest) {
  return handleCron(req);
}
export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  // ─── 1) 외부 호출 차단 (Workers cron 은 internal 이지만 외부 노출은 차단) ───
  const expectedSecret = process.env.CRON_SECRET || '';
  const url = new URL(req.url);
  const providedSecret =
    req.headers.get('x-cron-secret') ||
    url.searchParams.get('secret') ||
    '';

  // CRON_SECRET 이 설정되어 있고 일치하지 않으면 거부
  // (Cloudflare Workers scheduled() 가 직접 호출하는 경우는 secret 없이도 통과 가능하도록
  //  Workers 내부 헤더 'cf-cron' 도 허용 - 실제 cf-cron 헤더 존재 여부는 Workers 환경에서 자동 부여)
  const isWorkersCron = req.headers.get('cf-cron') === 'true' || req.headers.get('x-cf-cron') === 'true';
  if (expectedSecret && !isWorkersCron && providedSecret !== expectedSecret) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const startedAt = Date.now();
  const prisma = await getPrisma();

  // ─── 2) 30분 이상 PENDING 주문 조회 ───
  // 안전 cutoff: 현재시각 - 30분
  // ⚠️ D1 호환성: Date 객체는 D1_TYPE_ERROR 발생 → ISO string 으로 변환 후 전달
  const CUTOFF_MS = 30 * 60 * 1000; // 30분
  const cutoffDate = new Date(Date.now() - CUTOFF_MS);
  const cutoffIso = cutoffDate.toISOString();

  let pendingOrders: any[] = [];
  try {
    pendingOrders = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoffIso as any },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentKey: true,
        createdAt: true,
        total: true,
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100, // 한 번에 최대 100건 (D1 쿼리 폭주 방지)
    });
  } catch (e: any) {
    console.error('[cron/cleanup-pending] findMany 실패:', e?.message || e);
    return NextResponse.json(
      { success: false, error: 'DB 조회 실패', detail: e?.message || String(e) },
      { status: 500 }
    );
  }

  console.log(
    '[cron/cleanup-pending] 30분 이상 PENDING 후보:',
    pendingOrders.length,
    '건, cutoff:',
    cutoffDate.toISOString()
  );

  let cancelled = 0;
  let skippedHadTid = 0;
  let skippedRaceCondition = 0;
  let failed = 0;
  const cancelledOrderNumbers: string[] = [];
  const skippedHadTidOrderNumbers: string[] = [];
  // 진단용: 24 failed 원인 추적을 위해 처음 5건의 에러 메시지 응답에 노출
  const failureReasons: Array<{ orderNumber: string; error: string; stack?: string }> = [];

  // ─── 3) 각 주문 처리 (트랜잭션 단위) ───
  for (const order of pendingOrders) {
    // 3-1) paymentKey(tid) 가 있으면 → 결제 승인됐을 가능성 → 보존 (관리자 수동 확인)
    if (order.paymentKey) {
      skippedHadTid++;
      skippedHadTidOrderNumbers.push(order.orderNumber);
      console.warn(
        '[cron/cleanup-pending] tid 존재 PENDING 건너뜀 (관리자 확인 필요):',
        order.orderNumber,
        'tid:',
        order.paymentKey
      );
      continue;
    }

    try {
      await prisma.$transaction(async (tx: any) => {
        // 3-2) 처리 직전 재확인 (race condition 차단)
        //    - 다른 경로(KISPG return)에서 이미 CONFIRMED 로 바뀌었으면 절대 취소 금지
        const fresh = await tx.order.findUnique({
          where: { id: order.id },
          select: { status: true, paymentKey: true },
        });

        if (!fresh || fresh.status !== 'PENDING') {
          // 이미 다른 상태로 바뀜 → skip (CONFIRMED/CANCELLED/SHIPPING/DELIVERED 등)
          skippedRaceCondition++;
          console.log(
            '[cron/cleanup-pending] race condition 감지 - 건너뜀:',
            order.orderNumber,
            'now status:',
            fresh?.status
          );
          return;
        }
        if (fresh.paymentKey) {
          // 그 사이 tid 가 사전 저장됨 → 보존
          skippedHadTid++;
          skippedHadTidOrderNumbers.push(order.orderNumber);
          console.warn(
            '[cron/cleanup-pending] 처리 직전 tid 사전저장 감지 - 건너뜀:',
            order.orderNumber
          );
          return;
        }

        // 3-3) 주문 취소 + cancelReason 기록
        // ⚠️ D1 호환성: Date 객체 직접 전달 시 D1_TYPE_ERROR 가능 → ISO string 사용
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date().toISOString() as any,
            cancelReason: '결제 미완료 (30분 자동 취소)',
          },
        });

        // 3-4) 재고 복구 (batch update - N+1 쿼리 제거)
        // 같은 productId 가 items 에 여러 번 나올 수 있으므로 productId 별로 합산
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
          await tx.$executeRawUnsafe(sql, ...params, ...productIds);
        }
      });

      cancelled++;
      cancelledOrderNumbers.push(order.orderNumber);
      console.log(
        '[cron/cleanup-pending] 취소+재고복구 완료:',
        order.orderNumber,
        'items:',
        order.items.length
      );
    } catch (e: any) {
      failed++;
      const errMsg = e?.message || String(e);
      const errStack = e?.stack ? String(e.stack).split('\n').slice(0, 5).join(' | ') : undefined;
      console.error(
        '[cron/cleanup-pending] 취소 실패:',
        order.orderNumber,
        errMsg,
        errStack
      );
      // 처음 5건의 에러만 응답에 노출 (응답 크기 제한)
      if (failureReasons.length < 5) {
        failureReasons.push({
          orderNumber: order.orderNumber,
          error: errMsg,
          stack: errStack,
        });
      }
    }
  }

  const elapsedMs = Date.now() - startedAt;
  const summary = {
    success: true,
    cutoffMinutes: 30,
    cutoffAt: cutoffDate.toISOString(),
    candidates: pendingOrders.length,
    cancelled,
    skippedHadTid,
    skippedRaceCondition,
    failed,
    elapsedMs,
    cancelledOrderNumbers,
    skippedHadTidOrderNumbers,
    // 진단용: 24 failed 추적 (정상 동작 검증 완료 후 제거 예정)
    failureReasons: failureReasons.length > 0 ? failureReasons : undefined,
  };
  console.log('[cron/cleanup-pending] summary:', JSON.stringify(summary));

  return NextResponse.json(summary);
}
