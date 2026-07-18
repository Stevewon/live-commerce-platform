import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1, adjustBalance } from '@/lib/balance';

/**
 * [v1.0.22] POST /api/admin/balance-requests/:id/approve
 * 관리자: 충전 신청 승인 → 사용자 잔액 원자 증가 + BalanceLedger 기록
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

    // 신청 조회
    const request: any = await db
      .prepare(`SELECT * FROM "BalanceRequest" WHERE "id" = ? LIMIT 1`)
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

    const type = String(request.type);
    const amount = Number(request.amount) || 0;
    const userId = String(request.userId);

    if (amount <= 0) {
      return NextResponse.json({ success: false, error: '금액이 유효하지 않습니다' }, { status: 400 });
    }

    // 잔액 증감 (사용자 노출 안전 문구만 사용)
    let currency: 'KRW' | 'QKEY';
    let reason: string;
    if (type === 'KRW_DEPOSIT') {
      currency = 'KRW';
      reason = '무통장입금 충전';
    } else if (type === 'QKEY_DEPOSIT') {
      currency = 'QKEY';
      reason = 'QKEY 충전';
    } else {
      return NextResponse.json({ success: false, error: '알 수 없는 충전 종류' }, { status: 400 });
    }

    const { newBalance, ledgerId } = await adjustBalance(
      db,
      userId,
      currency,
      amount, // 양수 = 충전
      reason,
      null,
      id
    );

    // BalanceRequest 상태 업데이트
    await db
      .prepare(
        `UPDATE "BalanceRequest"
         SET "status" = 'APPROVED',
             "approvedBy" = ?,
             "approvedAt" = CURRENT_TIMESTAMP,
             "adminNote" = ?,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = ?`
      )
      .bind(auth.userId, adminNote, id)
      .run();

    return NextResponse.json({
      success: true,
      data: {
        requestId: id,
        userId,
        currency,
        amount,
        newBalance,
        ledgerId,
      },
      message: '충전 신청이 승인되어 잔액이 반영되었습니다',
    });
  } catch (e: any) {
    console.error('[POST /api/admin/balance-requests/:id/approve] error:', e);
    return NextResponse.json(
      { success: false, error: e?.message || '승인 처리에 실패했습니다' },
      { status: 500 }
    );
  }
}
