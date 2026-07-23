import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1 } from '@/lib/balance';

/**
 * [진단] GET /api/admin/diagnose/find-user?q=원용진
 * 닉네임/이름/지갑 일부로 계정을 찾아 id/잔액/origin 을 보여준다.
 * (잘못 들어간 충전액 이전 대상 계정 확인용)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get('q') || '').trim();
    if (!q) {
      return NextResponse.json({ success: false, error: 'q(검색어)가 필요합니다' }, { status: 400 });
    }
    const like = `%${q}%`;

    const db = await getD1();
    const res = await db
      .prepare(
        `SELECT "id","nickname","name","origin","qrchatUid","role",
                "krwBalance","qkeyBalance","qtaBalance","securetQrUrl","createdAt"
         FROM "User"
         WHERE "nickname" LIKE ? OR "name" LIKE ? OR "securetQrUrl" LIKE ?
         ORDER BY "createdAt" DESC
         LIMIT 30`
      )
      .bind(like, like, like)
      .all();

    return NextResponse.json(
      { success: true, count: (res?.results || []).length, users: res?.results || [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    console.error('[GET /api/admin/diagnose/find-user] error:', e);
    return NextResponse.json({ success: false, error: e?.message || '조회 실패' }, { status: 500 });
  }
}
