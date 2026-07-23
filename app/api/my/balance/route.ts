import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1, getUserBalance, ensureQtaColumn } from '@/lib/balance';
import { ensureUserQrchatColumns } from '@/lib/ensureProductColumns';
import { getQrchatQkeyBalance } from '@/lib/qrchat-bridge';

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
    await ensureUserQrchatColumns(db); // origin/qrchatUid 컬럼 자동 보정 (멱등)
    const balance = await getUserBalance(db, auth.userId);

    // 퀀타리움 지갑주소(securetQrUrl) + 출처(origin) + 큐알쳇 uid 동시 조회
    let quantariumWallet: string | null = null;
    let origin: string | null = null;
    let qrchatUid: string | null = null;
    try {
      const row: any = await db
        .prepare(
          `SELECT "securetQrUrl" AS wallet, "origin" AS origin, "qrchatUid" AS qrchatUid FROM "User" WHERE "id" = ? LIMIT 1`
        )
        .bind(auth.userId)
        .first();
      quantariumWallet = row?.wallet || null;
      origin = row?.origin || null;
      qrchatUid = row?.qrchatUid || null;
    } catch {}

    // ★ B 회원(큐알쳇 연동): 실제 QKEY 잔액은 큐알쳇 Firebase 에 있으므로
    //   실시간 조회해서 표시한다. (쇼핑몰 D1 의 qkeyBalance 는 항상 0)
    //   조회 실패 시엔 로컬 값 유지 (로그인/마이페이지 자체는 계속 동작).
    let qkeyBalance = balance.qkeyBalance;
    let qkeySource: 'local' | 'qrchat' = 'local';
    if (qrchatUid) {
      try {
        const live = await getQrchatQkeyBalance(qrchatUid);
        if (live.ok && typeof live.qkeyBalance === 'number') {
          qkeyBalance = live.qkeyBalance;
          qkeySource = 'qrchat';
        }
      } catch (e) {
        console.error('[GET /api/my/balance] qrchat balance fetch failed:', e);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          krwBalance: balance.krwBalance,
          qkeyBalance: qkeyBalance,
          qkeySource, // 'qrchat'=큐알쳇 실시간 / 'local'=쇼핑몰 자체
          qkeyToKrwRate: 10, // 1 QKEY = 10 원
          qkeyBalanceInKrw: qkeyBalance * 10,
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
