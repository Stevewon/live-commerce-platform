import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1 } from '@/lib/balance';

/**
 * [v1.0.22] POST /api/admin/balance-requests/:id/reject
 * 관리자: 충전 신청 거부 (잔액 반영 없음, 상태만 변경)
 *
 * Body: { adminNote?: string }
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'id가 필요합니다' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const adminNote = body?.adminNote ? String(body.adminNote).slice(0, 500) : null;

    const db = await getD1();
    const request: any = await db
      .prepare(`SELECT "status" FROM "BalanceRequest" WHERE "id" = ? LIMIT 1`)
      .bind(id)
      .first();

    if (!request) {
      return NextResponse.json({ success: false, error: '신청을 찾을 수 없습니다' }, { status: 404 });
    }
    if (request.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: `이미 처리된 신청입니다 (현재 상태: ${request.status})` },
        { status: 409 }
      );
    }

    await db
      .prepare(
        `UPDATE "BalanceRequest"
         SET "status" = 'REJECTED',
             "approvedBy" = ?,
             "rejectedAt" = CURRENT_TIMESTAMP,
             "adminNote" = ?,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = ?`
      )
      .bind(auth.userId, adminNote, id)
      .run();

    return NextResponse.json({
      success: true,
      data: { requestId: id, status: 'REJECTED' },
      message: '충전 신청이 거부되었습니다',
    });
  } catch (e: any) {
    console.error('[POST /api/admin/balance-requests/:id/reject] error:', e);
    return NextResponse.json(
      { success: false, error: e?.message || '거부 처리에 실패했습니다' },
      { status: 500 }
    );
  }
}
