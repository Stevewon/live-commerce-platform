import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1, getUserBalance, ensureQtaColumn } from '@/lib/balance';

/**
 * [v1.0.22] GET /api/my/balance
 * 사용자 본인의 KRW/QKEY 잔액 조회
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;

    const db = await getD1();
    await ensureQtaColumn(db); // qtaBalance 컬럼 자동 보정 (멱등)
    const balance = await getUserBalance(db, auth.userId);

    // 퀀타리움 지갑주소 (컬럼명 securetQrUrl, 값은 0x 지갑주소)
    let quantariumWallet: string | null = null;
    try {
      const walletRow: any = await db
        .prepare(`SELECT "securetQrUrl" AS wallet FROM "User" WHERE "id" = ? LIMIT 1`)
        .bind(auth.userId)
        .first();
      quantariumWallet = walletRow?.wallet || null;
    } catch {}

    return NextResponse.json(
      {
        success: true,
        data: {
          krwBalance: balance.krwBalance,
          qkeyBalance: balance.qkeyBalance,
          qkeyToKrwRate: 10, // 1 QKEY = 10 원
          qkeyBalanceInKrw: balance.qkeyBalance * 10,
          // QTA 적립 (100원 = 1 QTA)
          qtaBalance: balance.qtaBalance,
          qtaToKrwRate: 100,
          qtaBalanceInKrw: balance.qtaBalance * 100,
          // 퀀타리움 지갑주소
          quantariumWallet,
        },
      },
      {
        headers: { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' },
      }
    );
  } catch (e: any) {
    console.error('[GET /api/my/balance] error:', e);
    return NextResponse.json(
      { success: false, error: e?.message || '잔액 조회에 실패했습니다' },
      { status: 500 }
    );
  }
}
