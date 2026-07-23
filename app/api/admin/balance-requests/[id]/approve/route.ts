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
    const submitterUserId = String(request.userId);
    const depositorName = request.depositorName ? String(request.depositorName).trim() : '';

    if (amount <= 0) {
      return NextResponse.json({ success: false, error: '금액이 유효하지 않습니다' }, { status: 400 });
    }

    // ===== 충전 대상 계정 결정 =====
    // 원칙: 입금자명(depositorName)으로 실제 회원을 찾아, 그 회원 계정에 충전한다.
    //       신청을 넣은 로그인 계정(submitterUserId)에 무조건 넣지 않는다.
    //       admin/manager 등 관리자 계정은 충전 대상에서 제외한다.
    const isAdminRole = (r: any) => {
      const role = String(r || '').toUpperCase();
      return role === 'ADMIN' || role === 'MANAGER';
    };

    let targetUser: any = null;

    if (depositorName) {
      // 입금자명과 일치하는 비관리자 회원 검색 (nickname 우선, 그다음 name)
      const byNick = await db
        .prepare(
          `SELECT * FROM "User"
           WHERE "nickname" = ? AND UPPER(COALESCE("role",'USER')) NOT IN ('ADMIN','MANAGER')
           LIMIT 2`
        )
        .bind(depositorName)
        .all();
      const nickRows: any[] = (byNick?.results as any[]) || [];

      if (nickRows.length === 1) {
        targetUser = nickRows[0];
      } else if (nickRows.length === 0) {
        const byName = await db
          .prepare(
            `SELECT * FROM "User"
             WHERE "name" = ? AND UPPER(COALESCE("role",'USER')) NOT IN ('ADMIN','MANAGER')
             LIMIT 2`
          )
          .bind(depositorName)
          .all();
        const nameRows: any[] = (byName?.results as any[]) || [];
        if (nameRows.length === 1) {
          targetUser = nameRows[0];
        } else if (nameRows.length > 1) {
          return NextResponse.json(
            {
              success: false,
              error: `입금자명 "${depositorName}"(으)로 일치하는 회원이 여러 명입니다. 수동 확인이 필요합니다.`,
              candidates: nameRows.map((u) => ({ id: u.id, nickname: u.nickname, name: u.name })),
            },
            { status: 409 }
          );
        }
      } else {
        // 닉네임 다중 일치
        return NextResponse.json(
          {
            success: false,
            error: `입금자명 "${depositorName}"(으)로 일치하는 회원이 여러 명입니다. 수동 확인이 필요합니다.`,
            candidates: nickRows.map((u) => ({ id: u.id, nickname: u.nickname, name: u.name })),
          },
          { status: 409 }
        );
      }
    }

    // 입금자명으로 못 찾은 경우: 신청 계정이 관리자면 거부(관리자 계정엔 충전 금지)
    if (!targetUser) {
      const submitter: any = await db
        .prepare(`SELECT * FROM "User" WHERE "id" = ? LIMIT 1`)
        .bind(submitterUserId)
        .first();
      if (submitter && !isAdminRole(submitter.role)) {
        targetUser = submitter;
      } else {
        return NextResponse.json(
          {
            success: false,
            error: depositorName
              ? `입금자명 "${depositorName}"(으)로 회원을 찾지 못했습니다. 회원 확인 후 처리하세요.`
              : '입금자명이 없어 충전 대상을 확인할 수 없습니다.',
          },
          { status: 404 }
        );
      }
    }

    const userId = String(targetUser.id);

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
        creditedTo: { id: userId, nickname: targetUser.nickname, name: targetUser.name },
        depositorName,
        currency,
        amount,
        newBalance,
        ledgerId,
      },
      message: `충전 신청이 승인되어 ${targetUser.nickname || targetUser.name || userId} 계정에 반영되었습니다`,
    });
  } catch (e: any) {
    console.error('[POST /api/admin/balance-requests/:id/approve] error:', e);
    return NextResponse.json(
      { success: false, error: e?.message || '승인 처리에 실패했습니다' },
      { status: 500 }
    );
  }
}
