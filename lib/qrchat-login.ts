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
import { getD1 } from '@/lib/balance';
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

  // ───────────────────────────────────────────────────────────────
  // 계정 조회 — 사장님 확정 매칭키: "지갑주소(securetQrUrl) + 닉네임 동시일치".
  //   같은 사람이 여러 번 로그인해도 항상 "동일 계정 1개"로 귀결되어야 한다.
  //   (절대 중복 생성 금지 — 충전잔액이 딴 계정에 꽂히는 사고 방지)
  //
  // 조회 순서(모두 같은 사람으로 수렴):
  //   1) qrchatUid 일치 (이미 연결된 계정)
  //   2) 지갑(securetQrUrl) + 닉네임 동시일치 (매칭키)  ← 핵심
  //   3) 지갑(securetQrUrl) 단독 일치 (닉만 바뀐 경우까지 흡수, 중복생성 방지)
  // ───────────────────────────────────────────────────────────────
  const db = await getD1();

  let row: any = null;
  // 1) qrchatUid
  row = await db
    .prepare(`SELECT * FROM "User" WHERE "qrchatUid" = ? LIMIT 1`)
    .bind(qrchatUid)
    .first();

  // 2) 지갑 + 닉네임 동시일치 (매칭키). securetQrUrl 에 지갑주소 저장됨.
  if (!row) {
    row = await db
      .prepare(
        `SELECT * FROM "User" WHERE LOWER("securetQrUrl") = ? AND "nickname" = ? LIMIT 1`
      )
      .bind(wallet, nickname)
      .first();
  }
  // 2-b) name 필드에 원본 닉이 저장된 케이스(B회원 접미사 처리 흔적) 흡수
  if (!row) {
    row = await db
      .prepare(
        `SELECT * FROM "User" WHERE LOWER("securetQrUrl") = ? AND "name" = ? LIMIT 1`
      )
      .bind(wallet, nickname)
      .first();
  }
  // 3) 지갑 단독 일치 (같은 지갑이면 동일인 — 중복 계정 생성 금지)
  if (!row) {
    row = await db
      .prepare(`SELECT * FROM "User" WHERE LOWER("securetQrUrl") = ? LIMIT 1`)
      .bind(wallet)
      .first();
  }

  let user: any = row;

  // 찾았으면: 연동 판별에 필요한 3필드(qrchatUid/지갑/닉)를 "비어있을 때만" 채워
  //   연결을 안정화한다. (기존 잔액/origin 은 절대 건드리지 않음)
  //   ★★ 핵심 버그 수정: 예전엔 qrchatUid 만 채우고 지갑(securetQrUrl)/닉네임은
  //      비어 있어도 그대로 뒀다. 그 결과 usesFirebaseQkey(=uid&&지갑&&닉) 가 false 가 되어
  //      · 마이페이지에 큐알쳇 쿠키 잔액이 0 으로 표시되고
  //      · QKEY 결제가 'QRCHAT_LINK_INCOMPLETE' 로 막혔다.
  //      SSO/직접로그인에서 받은 지갑·닉으로 빈 칸을 메워 연동을 완성시킨다.
  if (user) {
    try {
      const sets: string[] = [];
      const binds: any[] = [];
      if (!user.qrchatUid) {
        sets.push(`"qrchatUid" = ?`);
        binds.push(qrchatUid);
      }
      // 지갑(securetQrUrl) 이 비어 있으면 SSO 지갑으로 백필
      if (!String(user.securetQrUrl || '').trim() && wallet) {
        sets.push(`"securetQrUrl" = ?`);
        binds.push(wallet);
      }
      // 닉네임이 비어 있으면 SSO 닉으로 백필 (name 은 표시 겸용이라 건드리지 않음)
      if (!String(user.nickname || '').trim() && nickname) {
        sets.push(`"nickname" = ?`);
        binds.push(nickname);
      }
      if (sets.length > 0) {
        sets.push(`"updatedAt" = CURRENT_TIMESTAMP`);
        binds.push(user.id);
        await db
          .prepare(`UPDATE "User" SET ${sets.join(', ')} WHERE "id" = ?`)
          .bind(...binds)
          .run();
        if (!user.qrchatUid) user.qrchatUid = qrchatUid;
        if (!String(user.securetQrUrl || '').trim() && wallet) user.securetQrUrl = wallet;
        if (!String(user.nickname || '').trim() && nickname) user.nickname = nickname;
      }
    } catch {
      /* qrchatUid unique 충돌 등은 무시 (이미 다른 곳에 연결) */
    }
  } else {
    // 정말로 처음 보는 사람일 때만 신규 생성 (origin=QRCHAT)
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
