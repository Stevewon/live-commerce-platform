import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

/**
 * GET /api/admin/diagnose/payment
 *
 * 사장님 결제 이슈 진단용 — ADMIN 권한 필수.
 * KISPG 결제 흐름 추적을 위한 D1 직접 조회 엔드포인트.
 *
 * 쿼리 파라미터:
 *   - mode: 'amount' (금액 기준) | 'pending' | 'confirmed' | 'missing_key' | 'stats' (기본)
 *   - amount: mode=amount 일 때 사용 (예: 3010)
 *   - hours: 최근 N시간 (기본 24)
 *
 * paymentMethod 진입마커 해석:
 *   - '결제대기': KISPG request 라우트 자체 미호출
 *   - '결제창진입': KISPG 결제창 진입 OK, return 핸들러 미도달 (PG 측 문제)
 *   - '신용카드' + paymentKey 있음: 정상 완료
 *   - '신용카드' + paymentKey 없음: return 도달, DB 저장 silent fail
 */
export async function GET(req: NextRequest) {
  const prisma = await getPrisma();

  // 1) 관리자 인증
  const authResult = await verifyAuthToken(req);
  if (authResult instanceof NextResponse) return authResult;
  if (authResult.role !== 'ADMIN') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') || 'stats';
  const amount = parseInt(searchParams.get('amount') || '0');
  const hours = parseInt(searchParams.get('hours') || '24');

  try {
    const result: any = { mode, hours };

    // 항상 포함: paymentMethod × status 분포 통계
    const statsSql = `
      SELECT paymentMethod, status, COUNT(*) as cnt
      FROM "Order"
      WHERE createdAt > datetime('now', '-${hours} hours')
      GROUP BY paymentMethod, status
      ORDER BY cnt DESC
    `;
    result.stats = await prisma.$queryRawUnsafe(statsSql);

    if (mode === 'amount' && amount > 0) {
      result.orders = await prisma.$queryRawUnsafe(
        `SELECT id, orderNumber, status, paymentMethod, paymentKey, paidAt, total,
                guestPhone, guestEmail, shippingName, shippingPhone,
                createdAt, updatedAt
         FROM "Order"
         WHERE total = ?
         ORDER BY createdAt DESC
         LIMIT 10`,
        amount
      );
    } else if (mode === 'pending') {
      result.orders = await prisma.$queryRawUnsafe(
        `SELECT id, orderNumber, status, paymentMethod, paymentKey, total,
                guestPhone, shippingName, createdAt
         FROM "Order"
         WHERE status = 'PENDING'
           AND createdAt > datetime('now', '-${hours} hours')
         ORDER BY createdAt DESC
         LIMIT 30`
      );
    } else if (mode === 'confirmed') {
      result.orders = await prisma.$queryRawUnsafe(
        `SELECT id, orderNumber, status, paymentMethod, paymentKey, paidAt, total,
                shippingName, createdAt
         FROM "Order"
         WHERE status = 'CONFIRMED'
           AND createdAt > datetime('now', '-${hours} hours')
         ORDER BY createdAt DESC
         LIMIT 30`
      );
    } else if (mode === 'missing_key') {
      result.orders = await prisma.$queryRawUnsafe(
        `SELECT id, orderNumber, status, paymentMethod, paymentKey, total, createdAt
         FROM "Order"
         WHERE status = 'CONFIRMED'
           AND (paymentKey IS NULL OR paymentKey = '')
         ORDER BY createdAt DESC
         LIMIT 30`
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[admin/diagnose/payment] 조회 실패:', err?.message || err);
    return NextResponse.json(
      { success: false, error: err?.message || 'unknown error' },
      { status: 500 }
    );
  }
}
