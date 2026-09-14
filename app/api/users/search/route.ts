import { NextRequest, NextResponse } from 'next/server';
import { getD1 } from '@/lib/balance';
import { verifyAuthToken } from '@/lib/auth/middleware';

/**
 * GET /api/users/search?q=<닉네임>
 *
 * 선물하기 "받는 분" 선택용 회원(닉네임) 검색.
 *   - 큐라이브(QRLIVE) 회원 + 큐알쳇(QRCHAT) 회원 모두 같은 User 테이블에 있으므로
 *     닉네임 부분일치로 검색하면 양쪽 회원이 모두 검색된다.
 *   - 로그인한 사용자만 검색 가능.
 *   - 개인정보 보호: nickname / name(첫 글자만 노출) / phone(마스킹) / origin 만 반환.
 *     실제 배송지는 결제 단계에서 보내는 사람이 입력한다.
 */
export async function GET(request: NextRequest) {
  // 로그인 필요
  const auth = await verifyAuthToken(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  if (q.length < 1) {
    return NextResponse.json({ success: true, data: [] });
  }

  try {
    const db = await getD1();
    // 닉네임 부분일치 검색 (대소문자 무시). 닉네임 없는 계정은 제외.
    // 본인은 선물 대상에서 제외.
    const like = `%${q}%`;
    const result: any = await db
      .prepare(
        `SELECT "id", "nickname", "name", "phone", "origin"
         FROM "User"
         WHERE "nickname" IS NOT NULL
           AND "nickname" <> ''
           AND LOWER("nickname") LIKE LOWER(?)
           AND "id" <> ?
         ORDER BY
           CASE WHEN LOWER("nickname") = LOWER(?) THEN 0 ELSE 1 END,
           LENGTH("nickname") ASC
         LIMIT 20`
      )
      .bind(like, auth.userId, q)
      .all();

    const rows: any[] = result?.results || [];

    const data = rows.map((u) => {
      // 이름: 첫 글자만 노출 (예: 홍길동 → 홍**)
      const nm = (u.name || '').trim();
      const maskedName = nm
        ? Array.from(nm)[0] + '*'.repeat(Math.max(0, Array.from(nm).length - 1))
        : '';
      // 전화번호: 뒤 4자리만 노출 (예: 010****1234)
      const ph = (u.phone || '').replace(/[^0-9]/g, '');
      const maskedPhone = ph.length >= 4
        ? `${ph.slice(0, 3)}****${ph.slice(-4)}`
        : '';
      return {
        userId: u.id,
        nickname: u.nickname,
        maskedName,
        maskedPhone,
        origin: u.origin || 'QRLIVE', // QRLIVE | QRCHAT
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[USER_SEARCH_ERROR]', error);
    return NextResponse.json(
      { success: false, error: '회원 검색 중 오류가 발생했습니다.', data: [] },
      { status: 500 }
    );
  }
}
