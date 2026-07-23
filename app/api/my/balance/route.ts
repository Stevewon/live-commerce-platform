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

    // 퀀타리움 지갑주소(securetQrUrl) + 출처(origin) + 큐알쳇 uid/닉네임 동시 조회
    //   ⚠️ 결제 차감(app/api/orders)과 "동일한 판정 필드"를 가져와야 잔액이 어긋나지 않는다.
    let quantariumWallet: string | null = null;
    let origin: string | null = null;
    let qrchatUid: string | null = null;
    let qrchatWallet = '';
    let qrchatNick = '';
    try {
      const row: any = await db
        .prepare(
          `SELECT "securetQrUrl" AS wallet, "origin" AS origin, "qrchatUid" AS qrchatUid,
                  "nickname" AS nickname, "name" AS name
             FROM "User" WHERE "id" = ? LIMIT 1`
        )
        .bind(auth.userId)
        .first();
      quantariumWallet = row?.wallet || null;
      origin = row?.origin || null;
      qrchatUid = row?.qrchatUid || null;
      qrchatWallet = String(row?.wallet || '').trim().toLowerCase();
      qrchatNick = String(row?.nickname || row?.name || '').trim();
    } catch {}

    // ★ B 회원(큐알쳇 연동): 실제 QKEY 잔액은 큐알쳇 Firebase 에 있으므로
    //   실시간 조회해서 표시한다. (쇼핑몰 D1 의 qkeyBalance 는 항상 0)
    //   조회 실패 시엔 로컬 값 유지 (로그인/마이페이지 자체는 계속 동작).
    //
    //   ★★ 핵심 수정: "큐알쳇 잔액을 표시하는 조건" 을 "큐알쳇에서 차감하는 조건"
    //      (app/api/orders 의 usesFirebaseQkey = qrchatUid && wallet && nick) 과
    //      정확히 동일하게 맞춘다.
    //      - 예전엔 qrchatUid 만 있으면 큐알쳇 실시간 잔액을 보여줬는데,
    //        지갑/닉이 비면 결제는 로컬 D1 에서 차감되어 → 조회는 큐알쳇, 결제는 로컬 이
    //        서로 어긋나 "쇼핑 성공인데 큐톡/라이브 잔액 불일치" 가 발생했다.
    const usesFirebaseQkey = !!(qrchatUid && qrchatWallet && qrchatNick);
    let qkeyBalance = balance.qkeyBalance;
    let qkeySource: 'local' | 'qrchat' = 'local';
    if (usesFirebaseQkey) {
      try {
        const live = await getQrchatQkeyBalance(qrchatUid as string);
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
