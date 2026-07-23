import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1, adjustBalance } from '@/lib/balance';

/**
 * POST /api/admin/balance-transfer
 * 관리자: 잔액을 한 계정에서 다른 계정으로 이전 (잘못 들어간 충전액 정정용).
 * Body: { fromUserId, toUserId, currency: 'KRW'|'QKEY'|'QTA', amount, reason? }
 * - fromUserId 에서 차감(-amount) + toUserId 에 증가(+amount), 둘 다 BalanceLedger 기록.
 * - 관리자만 호출 가능. 원장(ledger)에 정정 사유 기록.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const fromUserId = String(body?.fromUserId || '').trim();
    const toUserId = String(body?.toUserId || '').trim();
    const currency = String(body?.currency || '').trim().toUpperCase();
    const amount = Number(body?.amount);
    const reason = body?.reason ? String(body.reason).slice(0, 200) : '관리자 잔액 정정 이전';

    if (!fromUserId || !toUserId) {
      return NextResponse.json({ success: false, error: 'fromUserId, toUserId 필요' }, { status: 400 });
    }
    if (fromUserId === toUserId) {
      return NextResponse.json({ success: false, error: '같은 계정으로 이전할 수 없습니다' }, { status: 400 });
    }
    if (!['KRW', 'QKEY', 'QTA'].includes(currency)) {
      return NextResponse.json({ success: false, error: 'currency는 KRW/QKEY/QTA' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'amount는 양수' }, { status: 400 });
    }

    const db = await getD1();

    // 1) 출금 계정에서 차감 (잔액 부족 시 adjustBalance 가 throw)
    const fromRes = await adjustBalance(
      db,
      fromUserId,
      currency as any,
      -amount,
      `${reason} (→ ${toUserId})`,
      null,
      null
    );

    // 2) 입금 계정에 증가
    const toRes = await adjustBalance(
      db,
      toUserId,
      currency as any,
      amount,
      `${reason} (← ${fromUserId})`,
      null,
      null
    );

    return NextResponse.json({
      success: true,
      data: {
        currency,
        amount,
        from: { userId: fromUserId, newBalance: fromRes.newBalance },
        to: { userId: toUserId, newBalance: toRes.newBalance },
      },
      message: '잔액 이전이 완료되었습니다',
    });
  } catch (e: any) {
    console.error('[POST /api/admin/balance-transfer] error:', e);
    return NextResponse.json(
      { success: false, error: e?.message || '잔액 이전에 실패했습니다' },
      { status: 500 }
    );
  }
}
