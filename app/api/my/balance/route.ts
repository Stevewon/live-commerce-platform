import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1, getUserBalance } from '@/lib/balance';

/**
 * [v1.0.22] GET /api/my/balance
 * 사용자 본인의 KRW/QKEY 잔액 조회
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;

    const db = await getD1();
    const balance = await getUserBalance(db, auth.userId);

    return NextResponse.json(
      {
        success: true,
        data: {
          krwBalance: balance.krwBalance,
          qkeyBalance: balance.qkeyBalance,
          qkeyToKrwRate: 10, // 1 QKEY = 10 원
          qkeyBalanceInKrw: balance.qkeyBalance * 10,
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
