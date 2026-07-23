import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1 } from '@/lib/balance';

/**
 * [진단] GET /api/admin/diagnose/balance
 * 충전 승인 후 KRW 가 안 찍히는 문제 원인 파악용.
 *  - 각 충전신청의 userId 와 그 유저의 현재 KRW/QKEY 잔액을 함께 보여준다.
 *  - 같은 지갑(securetQrUrl)/닉네임으로 중복 생성된 계정이 있는지 탐지.
 *  - 로그인한 관리자 본인 계정의 상태도 보여준다.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const db = await getD1();

    // 1) 충전신청 + 신청 대상 유저의 현재 잔액
    const reqRows = await db
      .prepare(
        `SELECT br."id" AS requestId, br."userId", br."type", br."amount", br."status",
                br."depositorName", br."approvedAt", br."createdAt",
                u."nickname", u."name", u."origin", u."qrchatUid",
                u."krwBalance", u."qkeyBalance", u."securetQrUrl"
         FROM "BalanceRequest" br
         LEFT JOIN "User" u ON u."id" = br."userId"
         ORDER BY br."createdAt" DESC
         LIMIT 30`
      )
      .all();

    // 2) 중복 계정 탐지: 같은 securetQrUrl(지갑) 을 가진 유저가 2개 이상?
    const dupRows = await db
      .prepare(
        `SELECT "securetQrUrl", COUNT(*) AS cnt,
                GROUP_CONCAT("id") AS ids,
                GROUP_CONCAT("nickname") AS nicks,
                GROUP_CONCAT("origin") AS origins,
                GROUP_CONCAT("krwBalance") AS krws,
                GROUP_CONCAT("qkeyBalance") AS qkeys,
                GROUP_CONCAT(COALESCE("qrchatUid",'')) AS uids
         FROM "User"
         WHERE "securetQrUrl" IS NOT NULL AND "securetQrUrl" != ''
         GROUP BY "securetQrUrl"
         HAVING COUNT(*) > 1
         LIMIT 30`
      )
      .all();

    // 3) 로그인한 관리자 본인 계정
    const me = await db
      .prepare(
        `SELECT "id","nickname","name","origin","qrchatUid","krwBalance","qkeyBalance","securetQrUrl","role"
         FROM "User" WHERE "id" = ? LIMIT 1`
      )
      .bind(auth.userId)
      .first();

    return NextResponse.json(
      {
        success: true,
        me,
        balanceRequests: reqRows?.results || [],
        duplicateWalletAccounts: dupRows?.results || [],
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    console.error('[GET /api/admin/diagnose/balance] error:', e);
    return NextResponse.json(
      { success: false, error: e?.message || '진단 실패' },
      { status: 500 }
    );
  }
}
