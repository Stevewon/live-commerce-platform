import { NextRequest, NextResponse } from 'next/server';
import { verifyQrliveSso } from '@/lib/qrchat-bridge';
import { loginQrchatIdentity } from '@/lib/qrchat-login';

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

    // 2~4) 공통 헬퍼: B 회원 조회/생성 + JWT 쿠키 세팅
    const out = await loginQrchatIdentity({
      uid: String(v.uid),
      nickname: v.nickname,
      walletAddress: v.walletAddress,
    });
    if (!out.ok) {
      return NextResponse.json(
        { success: false, error: out.error },
        { status: out.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: { user: out.user, token: out.token },
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
