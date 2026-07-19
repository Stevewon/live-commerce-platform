import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1, newId } from '@/lib/balance';

/**
 * [v1.0.22] POST /api/balance/deposit-request
 * 사용자가 충전 신청 (관리자 승인 대기)
 *
 * Body:
 *   { type: 'KRW_DEPOSIT', amount: number, depositorName: string }
 *   { type: 'QKEY_DEPOSIT', amount: number, txHash: string, senderAddress?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const type: string = String(body?.type || '').trim();
    const amount = Number(body?.amount);

    if (!['KRW_DEPOSIT', 'QKEY_DEPOSIT'].includes(type)) {
      return NextResponse.json(
        { success: false, error: '충전 종류가 유효하지 않습니다' },
        { status: 400 }
      );
    }
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      return NextResponse.json(
        { success: false, error: '충전 금액이 유효하지 않습니다 (양의 정수)' },
        { status: 400 }
      );
    }

    // 최소 충전 금액 정책 (오남용 방지)
    if (type === 'KRW_DEPOSIT' && amount < 1000) {
      return NextResponse.json(
        { success: false, error: '무통장입금 최소 충전 금액은 1,000원 입니다' },
        { status: 400 }
      );
    }
    if (type === 'QKEY_DEPOSIT' && amount < 1) {
      return NextResponse.json(
        { success: false, error: 'QKEY 최소 충전 수량은 1 QKEY 입니다' },
        { status: 400 }
      );
    }

    let depositorName: string | null = null;
    let txHash: string | null = null;
    let senderAddress: string | null = null;

    if (type === 'KRW_DEPOSIT') {
      depositorName = String(body?.depositorName || '').trim();
      if (!depositorName) {
        return NextResponse.json(
          { success: false, error: '입금자명을 입력해주세요' },
          { status: 400 }
        );
      }
      if (depositorName.length > 50) {
        return NextResponse.json(
          { success: false, error: '입금자명은 50자 이내로 입력해주세요' },
          { status: 400 }
        );
      }
    } else if (type === 'QKEY_DEPOSIT') {
      txHash = String(body?.txHash || '').trim();
      if (!txHash) {
        return NextResponse.json(
          { success: false, error: 'TX 해시를 입력해주세요' },
          { status: 400 }
        );
      }
      if (txHash.length < 8 || txHash.length > 200) {
        return NextResponse.json(
          { success: false, error: 'TX 해시 형식이 유효하지 않습니다' },
          { status: 400 }
        );
      }
      senderAddress = body?.senderAddress ? String(body.senderAddress).trim().slice(0, 100) : null;

      // 중복 신청 방지 (동일 TX hash 로 PENDING/APPROVED 이미 있으면 거부)
      const db = await getD1();
      const dup = await db
        .prepare(`SELECT "id" FROM "BalanceRequest" WHERE "txHash" = ? AND "status" IN ('PENDING','APPROVED') LIMIT 1`)
        .bind(txHash)
        .first();
      if (dup) {
        return NextResponse.json(
          { success: false, error: '이미 등록된 TX 해시입니다' },
          { status: 409 }
        );
      }
    }

    const db = await getD1();
    const requestId = newId();

    await db
      .prepare(
        `INSERT INTO "BalanceRequest"
         ("id","userId","type","amount","depositorName","txHash","senderAddress","status","createdAt","updatedAt")
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
      .bind(requestId, auth.userId, type, amount, depositorName, txHash, senderAddress)
      .run();

    return NextResponse.json({
      success: true,
      data: {
        id: requestId,
        type,
        amount,
        depositorName,
        txHash,
        status: 'PENDING',
      },
      message: '충전 신청이 접수되었습니다. 관리자 승인 후 잔액이 반영됩니다.',
    });
  } catch (e: any) {
    console.error('[POST /api/balance/deposit-request] error:', e);
    return NextResponse.json(
      { success: false, error: e?.message || '충전 신청 처리에 실패했습니다' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/balance/deposit-request
 * 본인의 충전 신청 이력 조회
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '30', 10) || 30, 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    const db = await getD1();
    const res = await db
      .prepare(
        `SELECT "id","type","amount","depositorName","txHash","senderAddress","status","adminNote","approvedAt","rejectedAt","createdAt"
         FROM "BalanceRequest"
         WHERE "userId" = ?
         ORDER BY "createdAt" DESC, "id" DESC
         LIMIT ? OFFSET ?`
      )
      .bind(auth.userId, limit, offset)
      .all();

    const rows = (res?.results || []) as any[];
    return NextResponse.json(
      { success: true, data: rows },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' } }
    );
  } catch (e: any) {
    console.error('[GET /api/balance/deposit-request] error:', e);
    return NextResponse.json(
      { success: false, error: e?.message || '충전 신청 이력 조회에 실패했습니다' },
      { status: 500 }
    );
  }
}
