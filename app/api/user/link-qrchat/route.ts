import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1 } from '@/lib/balance';
import { linkQrchatWallet, normWallet, normNick } from '@/lib/qrchat-bridge';
import { ensureUserQrchatColumns } from '@/lib/ensureProductColumns';

/**
 * POST /api/user/link-qrchat — A 회원(QRLIVE) 지갑연결
 * ---------------------------------------------------------------------------
 * 사장님 답변 (2): A 회원도 나중에 지갑을 등록해 QKEY 를 사용할 수 있다.
 * 흐름:
 *   1) 로그인한 A 회원이 지갑주소 + QRChat 닉네임 입력
 *   2) Functions linkQrchatWallet 로 QRChat 에서 (지갑 AND 닉네임) 정확히 1건 매칭
 *   3) 매칭된 qrchatUid 를 이 A 회원에 저장 → 이후 QKEY_BALANCE 결제 시 Firebase 차감
 *   ⚠️ origin 은 "QRLIVE" 로 유지 (A 정체성 보존, B 와 병합 아님).
 *   ⚠️ qrchatUid 는 UNIQUE → 이미 다른 계정에 연결된 uid 면 거부.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuthToken(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const body = await request.json().catch(() => ({}));
    const wallet = normWallet(body?.wallet || body?.walletAddress);
    const nick = normNick(body?.nickname || body?.nick);

    if (!wallet || !nick) {
      return NextResponse.json(
        { success: false, error: '지갑주소와 QRChat 닉네임을 입력해주세요.' },
        { status: 400 }
      );
    }
    if (!/^0x[0-9a-f]{40}$/.test(wallet)) {
      return NextResponse.json(
        { success: false, error: '지갑주소 형식이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    // 1) QRChat 에서 (지갑 AND 닉네임) 매칭 조회
    const link = await linkQrchatWallet(wallet, nick);
    if (!link.ok || !link.uid) {
      const err = String(link.error || 'no_match');
      const status = err === 'ambiguous' ? 409 : 404;
      const msg =
        err === 'ambiguous'
          ? '동일 지갑/닉네임 계정이 여러 개라 자동 연결할 수 없습니다. 고객센터로 문의해주세요.'
          : '입력하신 지갑주소와 닉네임에 해당하는 QRChat 계정을 찾을 수 없습니다.';
      return NextResponse.json({ success: false, error: msg, detail: err }, { status });
    }

    const d1 = await getD1();
    await ensureUserQrchatColumns(d1);

    // 2) 이 qrchatUid 가 이미 다른 계정에 연결됐는지 확인 (UNIQUE 보호)
    const existing: any = await d1
      .prepare(`SELECT "id" FROM "User" WHERE "qrchatUid" = ? LIMIT 1`)
      .bind(link.uid)
      .first();
    if (existing && existing.id !== userId) {
      return NextResponse.json(
        { success: false, error: '해당 QRChat 계정은 이미 다른 회원에 연결되어 있습니다.' },
        { status: 409 }
      );
    }

    // 3) 저장 (origin 은 건드리지 않음 — A 정체성 유지)
    await d1
      .prepare(
        `UPDATE "User" SET "qrchatUid" = ?, "securetQrUrl" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?`
      )
      .bind(link.uid, wallet, userId)
      .run();

    return NextResponse.json({
      success: true,
      message: 'QRChat 지갑이 연결되었습니다. 이제 QKEY 로 결제할 수 있습니다.',
      data: {
        qrchatUid: link.uid,
        nickname: link.nickname,
        walletAddress: link.walletAddress,
        qkeyBalance: link.qkeyBalance,
      },
    });
  } catch (error) {
    console.error('[LINK_QRCHAT_ERROR]', error);
    return NextResponse.json(
      { success: false, error: '지갑 연결 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
