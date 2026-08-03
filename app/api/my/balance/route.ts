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
    //   ★★ 핵심 수정 (오로로/오똥지 쿠키 0 표시 버그):
    //      큐알쳇 실시간 잔액 조회(getQrchatQkeyBalance)는 uid 만 있으면 된다.
    //      따라서 "표시" 는 qrchatUid 만 있으면 무조건 큐알쳇 실잔액을 보여준다.
    //      (예전엔 uid&&지갑&&닉 3개가 다 있어야만 조회 → 지갑/닉이 비면 0 원으로 떴다.)
    //
    //      그리고 조회 응답에는 지갑주소/닉네임이 함께 오므로, D1 에 비어 있던
    //      지갑(securetQrUrl)/닉네임을 이 시점에 "자가치유(self-heal)" 로 채워 넣는다.
    //      → 이후 QKEY 결제(usesFirebaseQkey = uid&&지갑&&닉)도 정상 동작하게 되어
    //        "잔액 0 + 쇼핑 불가" 문제가 근본적으로 해소된다.
    let qkeyBalance = balance.qkeyBalance;
    let qkeySource: 'local' | 'qrchat' = 'local';
    if (qrchatUid) {
      try {
        const live = await getQrchatQkeyBalance(qrchatUid as string);
        if (live.ok && typeof live.qkeyBalance === 'number') {
          qkeyBalance = live.qkeyBalance;
          qkeySource = 'qrchat';

          // 자가치유: D1 에 비어 있던 지갑/닉을 큐알쳇 응답값으로 백필해
          //          결제 판정(usesFirebaseQkey)까지 복구한다.
          const liveWallet = String(live.walletAddress || '').trim().toLowerCase();
          const liveNick = String(live.nickname || '').trim();
          const sets: string[] = [];
          const binds: any[] = [];
          if (!qrchatWallet && liveWallet) {
            sets.push(`"securetQrUrl" = ?`);
            binds.push(liveWallet);
          }
          if (!qrchatNick && liveNick) {
            sets.push(`"nickname" = ?`);
            binds.push(liveNick);
          }
          if (sets.length > 0) {
            sets.push(`"updatedAt" = CURRENT_TIMESTAMP`);
            binds.push(auth.userId);
            try {
              await db
                .prepare(`UPDATE "User" SET ${sets.join(', ')} WHERE "id" = ?`)
                .bind(...binds)
                .run();
              if (!quantariumWallet && liveWallet) quantariumWallet = liveWallet;
            } catch (healErr) {
              console.error('[GET /api/my/balance] self-heal wallet/nick failed:', healErr);
            }
          }
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
