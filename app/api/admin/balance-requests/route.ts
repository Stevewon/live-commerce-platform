import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1 } from '@/lib/balance';

/**
 * [v1.0.22] GET /api/admin/balance-requests
 * 관리자: 충전 신청 목록 조회 (모든 사용자)
 *
 * Query:
 *   - status: 'PENDING' | 'APPROVED' | 'REJECTED' | undefined(모두)
 *   - type: 'KRW_DEPOSIT' | 'QKEY_DEPOSIT' | undefined(모두)
 *   - limit / offset
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    const db = await getD1();

    const wheres: string[] = [];
    const params: any[] = [];
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      wheres.push(`br."status" = ?`);
      params.push(status);
    }
    if (type && ['KRW_DEPOSIT', 'QKEY_DEPOSIT'].includes(type)) {
      wheres.push(`br."type" = ?`);
      params.push(type);
    }
    const whereClause = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';

    const sql = `
      SELECT
        br."id", br."userId", br."type", br."amount",
        br."depositorName", br."txHash", br."senderAddress",
        br."status", br."adminNote", br."approvedBy", br."approvedAt", br."rejectedAt",
        br."createdAt", br."updatedAt",
        u."email" AS "userEmail", u."nickname" AS "userNickname", u."name" AS "userName", u."phone" AS "userPhone"
      FROM "BalanceRequest" br
      LEFT JOIN "User" u ON u."id" = br."userId"
      ${whereClause}
      ORDER BY
        CASE WHEN br."status" = 'PENDING' THEN 0 ELSE 1 END,
        br."createdAt" DESC, br."id" DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const res = await db.prepare(sql).bind(...params).all();
    const rows = (res?.results || []) as any[];

    // 총 건수 (페이지네이션)
    const countSql = `SELECT COUNT(*) AS cnt FROM "BalanceRequest" br ${whereClause}`;
    const countParams = params.slice(0, params.length - 2);
    const countRow: any = await db.prepare(countSql).bind(...countParams).first();
    const total = Number(countRow?.cnt) || 0;

    // 상태별 요약 (대시보드용)
    const summaryRes = await db
      .prepare(
        `SELECT "status", COUNT(*) AS cnt FROM "BalanceRequest" GROUP BY "status"`
      )
      .all();
    const summary: Record<string, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const r of (summaryRes?.results || []) as any[]) {
      summary[String(r.status)] = Number(r.cnt) || 0;
    }

    return NextResponse.json(
      {
        success: true,
        data: rows,
        pagination: { total, limit, offset },
        summary,
      },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' } }
    );
  } catch (e: any) {
    console.error('[GET /api/admin/balance-requests] error:', e);
    return NextResponse.json(
      { success: false, error: e?.message || '충전 신청 목록 조회에 실패했습니다' },
      { status: 500 }
    );
  }
}
