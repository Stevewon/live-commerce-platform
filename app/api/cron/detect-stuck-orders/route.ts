import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

/**
 * GET/POST /api/cron/detect-stuck-orders
 *
 * [2026-05-12 옵션 3-2] PENDING+'결제창진입' 5분 임계치 감지 cron (자동 취소 X, 감지/로깅 전용)
 *
 * 배경:
 * - 지나/hero zina 사례: 카드 결제 완료했으나 KISPG return 핸들러 도달 실패 →
 *   PENDING 상태 + paymentMethod='결제창진입' 으로 멈춤 → 사용자 화면 "결제대기" 무한 노출
 * - 30분 cleanup cron 은 너무 늦음 (그 사이 사장님 미인지)
 * - 5분 임계치로 빠르게 감지 → 어드민 대시보드 옵션 3-3 에서 노출 + 향후 알림 hook
 *
 * 역할 분리 (cleanup-pending-orders 와 명확히 다름):
 * - cleanup-pending-orders: 30분 후 자동 취소 + 재고 복구 (paymentKey 없을 때만)
 * - detect-stuck-orders   : 5분~30분 사이 stuck 의심 주문을 식별/리포팅만 (취소 X)
 *
 * 감지 조건:
 * 1) status = 'PENDING'
 * 2) paymentMethod IN ('결제창진입', '신용카드', '결제대기') — KISPG 진입마커
 * 3) createdAt: 5분 이상 ~ 30분 미만 (30분 초과는 cleanup cron 이 처리)
 * 4) paymentKey IS NULL — TID 없음 (있으면 sync 안전망에서 처리됨)
 *
 * 트리거:
 * - GitHub Actions schedule (사장님 영구 룰: cron 트리거 단 1개씩 분리)
 * - .github/workflows/detect-stuck-orders.yml — 5분마다 실행
 *
 * 인증: cleanup-pending-orders 와 동일 패턴 (CRON_SECRET)
 *
 * 응답:
 * - { success: true, stuckCount, stuckOrders: [...] }
 * - 어드민 대시보드 옵션 3-3 가 동일 조건으로 직접 조회하므로 cron 결과는 GitHub Actions 로그에만 기록
 */
export async function GET(req: NextRequest) {
  return handleCron(req);
}
export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  // ─── 1) 외부 호출 차단 ───
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

  // ─── 2) 5분~30분 임계치 PENDING+진입마커 조회 ───
  // ⚠️ D1 호환성: Date → ISO string
  const FIVE_MIN_MS = 5 * 60 * 1000;
  const THIRTY_MIN_MS = 30 * 60 * 1000;
  const now = Date.now();
  const stuckUpperIso = new Date(now - FIVE_MIN_MS).toISOString();  // 5분 이전 (오래된 쪽)
  const stuckLowerIso = new Date(now - THIRTY_MIN_MS).toISOString(); // 30분 이전 (더 오래된 쪽)

  // KISPG 진입 마커 paymentMethod 들
  const ENTRY_MARKERS = ['결제대기', '결제창진입', '신용카드'];

  let stuckOrders: any[] = [];
  try {
    // D1 wrapper 호환성: raw SQL 로 안전하게 조회 (groupBy 와 nested filter 모두 회피)
    // - status = 'PENDING'
    // - paymentMethod IN (...)
    // - createdAt BETWEEN stuckLowerIso AND stuckUpperIso (30분 이전 ~ 5분 이전 사이)
    // - paymentKey IS NULL OR paymentKey = ''
    const placeholders = ENTRY_MARKERS.map(() => '?').join(',');
    const sql = `
      SELECT id, orderNumber, status, paymentMethod, paymentKey, total,
             customerName, customerPhone, customerEmail, userId, createdAt
      FROM "Order"
      WHERE status = 'PENDING'
        AND paymentMethod IN (${placeholders})
        AND (paymentKey IS NULL OR paymentKey = '')
        AND createdAt > ?
        AND createdAt < ?
      ORDER BY createdAt ASC
      LIMIT 100
    `;
    stuckOrders = (await prisma.$queryRawUnsafe(
      sql,
      ...ENTRY_MARKERS,
      stuckLowerIso, // createdAt > stuckLowerIso (30분 이내)
      stuckUpperIso  // createdAt < stuckUpperIso (5분 이전)
    )) as any[];
  } catch (e: any) {
    console.error('[cron/detect-stuck-orders] 조회 실패:', e?.message || e);
    return NextResponse.json(
      { success: false, error: 'DB 조회 실패', detail: e?.message || String(e) },
      { status: 500 }
    );
  }

  const stuckCount = stuckOrders.length;

  // ─── 3) 결과 정형화 (어드민/알림 hook 에서 재사용 가능한 형태) ───
  const formatted = stuckOrders.map((o) => {
    const createdMs = typeof o.createdAt === 'string'
      ? Date.parse(o.createdAt)
      : (o.createdAt instanceof Date ? o.createdAt.getTime() : 0);
    const ageMinutes = createdMs > 0 ? Math.floor((now - createdMs) / 60000) : null;
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      paymentMethod: o.paymentMethod,
      total: Number(o.total) || 0,
      customerName: o.customerName || null,
      customerPhone: o.customerPhone || null,
      userId: o.userId || null,
      isGuest: !o.userId,
      createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date(createdMs).toISOString(),
      ageMinutes,
    };
  });

  // ─── 4) 로깅 (GitHub Actions 로그 + Cloudflare observability) ───
  if (stuckCount > 0) {
    console.warn(
      `[cron/detect-stuck-orders] ★★★ STUCK 의심 주문 ${stuckCount}건 감지 ★★★`,
      JSON.stringify(formatted.map(f => ({
        orderNumber: f.orderNumber,
        ageMinutes: f.ageMinutes,
        total: f.total,
        customerPhone: f.customerPhone,
      })))
    );
  } else {
    console.log('[cron/detect-stuck-orders] stuck 주문 0건 (정상)');
  }

  const elapsedMs = Date.now() - startedAt;
  return NextResponse.json({
    success: true,
    thresholdMinutes: { min: 5, max: 30 },
    entryMarkers: ENTRY_MARKERS,
    stuckCount,
    stuckOrders: formatted,
    elapsedMs,
    scannedAt: new Date(now).toISOString(),
  });
}
