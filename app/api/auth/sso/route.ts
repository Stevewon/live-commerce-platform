import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPrisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';
import { verifyQrliveSso, normWallet, normNick } from '@/lib/qrchat-bridge';
import { ensureUserQrchatColumns } from '@/lib/ensureProductColumns';

/**
 * POST /api/auth/sso — QRChat SSO 자동로그인
 * ---------------------------------------------------------------------------
 * 흐름 (사장님 확정 규칙):
 *   1) QRChat 앱이 createQrliveSsoTicket 로 받은 ssoToken 을 전달
 *   2) Functions verifyQrliveSso 로 검증 + 1회 소비 → uid/닉네임/지갑 확보
 *   3) origin="QRCHAT" + qrchatUid 로 B 회원을 찾음
 *        - 없으면 자동 생성 (별도 회원가입 없이)  ← 사장님 요구
 *        - A 회원(origin="QRLIVE")과 절대 자동병합하지 않음
 *   4) JWT 발급 → auth-token 쿠키 세팅 (login route 와 동일 패턴)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const ssoToken = String(body?.token || body?.ssoToken || '').trim();
    if (!ssoToken) {
      return NextResponse.json(
        { success: false, error: 'SSO 토큰이 없습니다.' },
        { status: 400 }
      );
    }

    // 1) Functions 로 토큰 검증 + 1회 소비
    const v = await verifyQrliveSso(ssoToken);
    if (!v.ok || !v.uid) {
      return NextResponse.json(
        { success: false, error: 'SSO 검증 실패', detail: v.error },
        { status: 401 }
      );
    }

    const qrchatUid = String(v.uid);
    const nickname = normNick(v.nickname);
    const wallet = normWallet(v.walletAddress);

    if (!nickname || !wallet) {
      return NextResponse.json(
        { success: false, error: 'QRChat 사용자 정보(닉네임/지갑) 누락' },
        { status: 422 }
      );
    }

    const prisma = await getPrisma();
    await ensureUserQrchatColumns();

    // 2) B 회원 조회 — qrchatUid 우선 (가장 강한 키)
    let user = await prisma.user.findFirst({
      where: { qrchatUid },
    });

    // 3) 없으면 자동 생성 (origin=QRCHAT). A 회원과 병합 금지.
    if (!user) {
      // 닉네임 충돌 회피: B 회원 네임스페이스에 접미사(_qc) 부여
      //  → A 회원 닉네임 유니크 제약과 충돌하지 않도록. 실제 표시용은 name 에 원본 유지.
      let uniqueNickname = nickname;
      const clash = await prisma.user.findUnique({ where: { nickname } });
      if (clash) {
        uniqueNickname = `${nickname}_qc_${qrchatUid.slice(-6)}`;
      }

      // 결제는 QRChat 잔액을 직접 차감하므로 로컬 password 는 임의값(로그인 불가용)
      const randomPw = await hashPassword(
        `qrchat_sso_${qrchatUid}_${crypto.randomUUID()}`
      );

      user = await prisma.user.create({
        data: {
          nickname: uniqueNickname,
          name: nickname,
          password: randomPw,
          role: 'CUSTOMER',
          securetQrUrl: wallet, // 지갑주소 저장 (본인확인 식별자)
          origin: 'QRCHAT', // ★ 출처 구분: 절대 A(QRLIVE)와 병합 안 함
          qrchatUid, // ★ QKEY 직접 차감 매칭 키
          krwBalance: 0,
          qkeyBalance: 0, // 쇼핑몰 자체 QKEY 지급 없음 — 결제는 Firebase 직접 차감
          qtaBalance: 0,
        },
      });
    } else if (user.origin !== 'QRCHAT') {
      // qrchatUid 가 A 회원(QRLIVE)에 매핑된 경우 = 지갑연결한 A 회원.
      // 그대로 로그인시키되 origin 은 유지 (A 정체성 보존).
    }

    // 4) JWT 발급 + 쿠키 세팅 (login route 와 동일)
    const token = generateToken({
      userId: user.id,
      nickname: user.nickname || user.name || user.id,
      role: user.role,
      name: user.name,
    });

    const cookieStore = await cookies();
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    cookieStore.set('user-role', user.role, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    const { password: _pw, ...userSafe } = user as any;
    return NextResponse.json({
      success: true,
      data: { user: userSafe, token },
      message: 'QRChat 자동로그인 성공',
    });
  } catch (error) {
    console.error('[SSO_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'SSO 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
