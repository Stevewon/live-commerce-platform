/**
 * QRChat 회원 로그인 공통 처리 (SSO 자동로그인 + 웹 직접로그인 공용)
 * ============================================================================
 * QRChat 신원(uid/닉네임/지갑)을 받아 쇼핑몰의 B 회원(origin="QRCHAT")을
 * 찾거나 자동 생성하고, JWT 를 발급해 auth-token / user-role 쿠키를 세팅한다.
 *
 * - /api/auth/sso          : 앱 SSO 토큰 검증(verifyQrliveSso) 후 이 헬퍼 호출
 * - /api/auth/login (폴백) : 쇼핑몰 DB 실패 시 qrchatDirectLogin 후 이 헬퍼 호출
 *
 * 사장님 확정 규칙:
 *   - A 회원(origin="QRLIVE")과 절대 자동병합하지 않는다.
 *   - qrchatUid 를 가장 강한 매칭키로 사용한다.
 *   - 결제는 QRChat Firebase 잔액을 직접 차감하므로 로컬 password 는 임의값.
 */
import { cookies } from 'next/headers';
import { getPrisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';
import { normWallet, normNick } from '@/lib/qrchat-bridge';
import { ensureUserQrchatColumns } from '@/lib/ensureProductColumns';

export interface QrchatIdentity {
  uid: string;
  nickname?: string | null;
  walletAddress?: string | null;
}

export interface QrchatLoginOutcome {
  ok: boolean;
  status: number;
  error?: string;
  user?: any;
  token?: string;
}

/**
 * QRChat 신원으로 B 회원을 찾거나 생성하고 세션 쿠키를 세팅한다.
 * 성공 시 { ok:true, user, token } 반환 (라우트에서 그대로 응답).
 */
export async function loginQrchatIdentity(
  ident: QrchatIdentity
): Promise<QrchatLoginOutcome> {
  const qrchatUid = String(ident.uid || '').trim();
  const nickname = normNick(ident.nickname);
  const wallet = normWallet(ident.walletAddress);

  if (!qrchatUid) {
    return { ok: false, status: 401, error: 'QRChat 사용자 식별 실패' };
  }
  if (!nickname || !wallet) {
    return {
      ok: false,
      status: 422,
      error: 'QRChat 사용자 정보(닉네임/지갑) 누락',
    };
  }

  const prisma = await getPrisma();
  await ensureUserQrchatColumns();

  // qrchatUid 우선 (가장 강한 키)
  let user = await prisma.user.findFirst({ where: { qrchatUid } });

  // 없으면 자동 생성 (origin=QRCHAT). A 회원과 병합 금지.
  if (!user) {
    let uniqueNickname = nickname;
    const clash = await prisma.user.findUnique({ where: { nickname } });
    if (clash) {
      uniqueNickname = `${nickname}_qc_${qrchatUid.slice(-6)}`;
    }

    const randomPw = await hashPassword(
      `qrchat_login_${qrchatUid}_${crypto.randomUUID()}`
    );

    user = await prisma.user.create({
      data: {
        nickname: uniqueNickname,
        name: nickname,
        password: randomPw,
        role: 'CUSTOMER',
        securetQrUrl: wallet,
        origin: 'QRCHAT',
        qrchatUid,
        krwBalance: 0,
        qkeyBalance: 0,
        qtaBalance: 0,
      },
    });
  }

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
  return { ok: true, status: 200, user: userSafe, token };
}
