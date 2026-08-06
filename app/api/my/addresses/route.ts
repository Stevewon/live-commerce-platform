import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1 } from '@/lib/balance';

export const dynamic = 'force-dynamic';

/**
 * GET /api/my/addresses
 * ============================================================================
 * 로그인 회원이 "이전에 실제로 주문했던" 배송지 목록을 최근순으로 반환한다.
 *   - 쿠팡/카톡처럼 결제화면에서 지난 배송지를 골라 쓸 수 있게 하기 위함.
 *   - 별도 주소록 테이블 없이 Order 의 배송정보(shippingName/Phone/Address/ZipCode/Memo)
 *     에서 중복을 제거해 뽑아낸다. (스키마 변경 불필요)
 *   - 개인정보이므로 반드시 "본인(userId)" 주문만 조회한다.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuthToken(req);
    if (auth instanceof NextResponse) return auth;

    const db = await getD1();

    // 본인 주문의 배송정보를 최근순으로. (넉넉히 50건 훑고 앱단에서 중복제거 → 최대 8개)
    let rows: any[] = [];
    try {
      const res = await db
        .prepare(
          `SELECT "shippingName"    AS name,
                  "shippingPhone"   AS phone,
                  "shippingAddress" AS address,
                  "shippingZipCode" AS zipCode,
                  "shippingMemo"    AS memo,
                  MAX("createdAt")  AS lastUsedAt,
                  COUNT(*)          AS useCount
             FROM "Order"
            WHERE "userId" = ?
              AND "shippingAddress" IS NOT NULL
              AND TRIM("shippingAddress") <> ''
            GROUP BY "shippingName", "shippingPhone", "shippingAddress", "shippingZipCode"
            ORDER BY MAX("createdAt") DESC
            LIMIT 8`
        )
        .bind(auth.userId)
        .all();
      rows = (res?.results as any[]) || [];
    } catch (e) {
      console.error('[GET /api/my/addresses] query failed:', e);
      rows = [];
    }

    const addresses = rows
      .filter((r) => r && String(r.address || '').trim())
      .map((r, idx) => ({
        id: `addr-${idx}`,
        name: String(r.name || '').trim(),
        phone: String(r.phone || '').trim(),
        address: String(r.address || '').trim(),
        zipCode: String(r.zipCode || '').trim(),
        memo: String(r.memo || '').trim(),
        lastUsedAt: r.lastUsedAt || null,
        useCount: Number(r.useCount) || 1,
      }));

    return NextResponse.json({ success: true, data: addresses });
  } catch (error: any) {
    console.error('[GET /api/my/addresses] error:', error);
    // 실패해도 결제 흐름을 막지 않도록 빈 배열로 응답
    return NextResponse.json({ success: true, data: [] });
  }
}
