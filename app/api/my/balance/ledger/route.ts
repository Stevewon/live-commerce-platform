import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1 } from '@/lib/balance';

/**
 * [v1.0.22] GET /api/my/balance/ledger
 * 사용자 본인의 잔액 증감 이력 조회 (최신 순)
 *
 * Query:
 *   - currency: 'KRW' | 'QKEY' | undefined(모두)
 *   - limit: 1~100 (기본 50)
 *   - offset: 0~ (기본 0)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const currency = searchParams.get('currency');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    const db = await getD1();

    let sql = `SELECT "id", "currency", "amount", "balanceAfter", "reason", "relatedOrderId", "relatedRequestId", "createdAt"
               FROM "BalanceLedger"
               WHERE "userId" = ?`;
    const params: any[] = [auth.userId];

    if (currency && (currency === 'KRW' || currency === 'QKEY')) {
      sql += ` AND "currency" = ?`;
      params.push(currency);
    }

    sql += ` ORDER BY "createdAt" DESC, "id" DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const res = await db.prepare(sql).bind(...params).all();
    const rows = (res?.results || []) as any[];

    // 총 건수 (페이지네이션)
    let countSql = `SELECT COUNT(*) AS cnt FROM "BalanceLedger" WHERE "userId" = ?`;
    const countParams: any[] = [auth.userId];
    if (currency && (currency === 'KRW' || currency === 'QKEY')) {
      countSql += ` AND "currency" = ?`;
      countParams.push(currency);
    }
    const countRow: any = await db.prepare(countSql).bind(...countParams).first();
    const total = Number(countRow?.cnt) || 0;

    return NextResponse.json(
      {
        success: true,
        data: rows.map((r) => ({
          id: r.id,
          currency: r.currency,
          amount: Number(r.amount) || 0,
          balanceAfter: Number(r.balanceAfter) || 0,
          reason: r.reason || '',
          relatedOrderId: r.relatedOrderId || null,
          relatedRequestId: r.relatedRequestId || null,
          createdAt: r.createdAt,
        })),
        pagination: { total, limit, offset },
      },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' } }
    );
  } catch (e: any) {
    console.error('[GET /api/my/balance/ledger] error:', e);
    return NextResponse.json(
      { success: false, error: e?.message || '잔액 이력 조회에 실패했습니다' },
      { status: 500 }
    );
  }
}
