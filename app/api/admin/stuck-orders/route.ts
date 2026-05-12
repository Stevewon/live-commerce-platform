import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

/**
 * GET /api/admin/stuck-orders
 *
 * [2026-05-12 옵션 3-3] 어드민 대시보드 stuck-orders 위젯용 조회 API
 *
 * 감지 조건 (detect-stuck-orders cron 과 동일):
 * 1) status = 'PENDING'
 * 2) paymentMethod IN ('결제대기', '결제창진입', '신용카드') — KISPG 진입마커
 * 3) createdAt: 5분 이상 ~ 24시간 미만
 *    - cron 은 5~30분만 보지만, 어드민은 24시간까지 노출 (사장님이 수동 처리 가능하도록)
 * 4) paymentKey IS NULL OR '' — TID 없음 (있으면 sync 안전망 처리됨)
 *
 * 응답:
 *   { success: true, items: [{ id, orderNumber, total, customerName, customerPhone, ageMinutes, ... }] }
 *
 * D1 호환성: raw SQL ($queryRawUnsafe) 사용 (nested filter / groupBy 회피)
 */
export async function GET(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(request);
    if (authResult instanceof NextResponse) return authResult;
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    const FIVE_MIN_MS = 5 * 60 * 1000;
    const TWENTY_FOUR_HR_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const upperIso = new Date(now - FIVE_MIN_MS).toISOString();
    const lowerIso = new Date(now - TWENTY_FOUR_HR_MS).toISOString();

    const ENTRY_MARKERS = ['결제대기', '결제창진입', '신용카드'];
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
      ORDER BY createdAt DESC
      LIMIT 100
    `;
    const rows = (await prisma.$queryRawUnsafe(
      sql,
      ...ENTRY_MARKERS,
      lowerIso,
      upperIso
    )) as any[];

    const items = rows.map((o) => {
      const createdMs = typeof o.createdAt === 'string'
        ? Date.parse(o.createdAt)
        : (o.createdAt instanceof Date ? o.createdAt.getTime() : 0);
      const ageMinutes = createdMs > 0 ? Math.floor((now - createdMs) / 60000) : null;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        paymentMethod: o.paymentMethod || null,
        total: Number(o.total) || 0,
        customerName: o.customerName || null,
        customerPhone: o.customerPhone || null,
        customerEmail: o.customerEmail || null,
        userId: o.userId || null,
        isGuest: !o.userId,
        createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date(createdMs).toISOString(),
        ageMinutes,
      };
    });

    return NextResponse.json({
      success: true,
      count: items.length,
      thresholdMinutes: { min: 5, max: 60 * 24 },
      entryMarkers: ENTRY_MARKERS,
      scannedAt: new Date(now).toISOString(),
      items,
    });
  } catch (error: any) {
    console.error('[admin/stuck-orders] error:', error?.message || error);
    return NextResponse.json(
      { success: false, error: '조회 실패', detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}
