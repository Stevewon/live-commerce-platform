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
 *   - ★★★ 매칭키는 "지갑주소(securetQrUrl) + 닉네임 동시일치". qrchatUid 는 캐시.
 *   - 결제는 QRChat Firebase 잔액을 직접 차감하므로 로컬 password 는 임의값.
 *
 * ★★★ 2026-08-03 수정 (오로로 사건):
 *   ─ 문제: 큐알쳇 앱을 재설치/재가입해 uid 가 바뀌면 쇼핑몰 D1 은 옛 uid 로
 *          큐알쳇 잔액을 조회 → Firebase 에 그 uid 없음 → 마이페이지 0 표시.
 *   ─ 실제 케이스: 오로로 D1 qrchatUid=1771146200132(옛), 큐알쳇 실제=1785378429362(새).
 *                지갑주소·닉네임은 완전히 동일. 매칭키는 살아있었는데 조회순서가
 *                qrchatUid 우선이라 옛 계정으로 잠겨서 갱신이 안 됐음.
 *   ─ 수정: (1) 조회 최우선을 "지갑+닉 동시일치"로 승격 (원래 사장님 원칙).
 *           (2) qrchatUid 우선순위를 최후 폴백으로 강등 (지갑/닉으로 못 찾을 때만).
 *           (3) 지갑 일치로 찾은 계정의 qrchatUid 가 SSO 값과 다르면 자동 갱신.
 *               (지갑이 동시일치 확인된 상태이므로 계정 탈취 위험 없음)
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
  // ★★★ 2026-08-03 수정: qrchatUid 우선순위 강등.
  //   기존: qrchatUid → 지갑+닉 → name 폴백 → 지갑단독
  //   신규: 지갑+닉 → name 폴백 → 지갑단독 → qrchatUid (최후)
  //   이유: qrchatUid 는 앱 재설치/재가입 시 새로 발급될 수 있는 값(휘발성 캐시).
  //         지갑+닉은 사장님 원칙상 "동일인"을 결정하는 진짜 매칭키.
  //         옛 uid 로 먼저 잠기면 지갑+닉이 같아도 qrchatUid 갱신이 안 됐음
  //         (오로로 사건: D1=1771146200132, 앱실제=1785378429362, 지갑·닉 동일).
  //   ─── 도출된 조회 순서 (모두 "동일인 1계정"으로 수렴) ───
  //   1) 지갑 + 닉네임 동시일치 (매칭키 — 사장님 원칙 최우선)
  //   2) 지갑 + name 동시일치 (B회원 접미사 처리 흔적 흡수)
  //   3) 지갑 단독 일치 (같은 지갑이면 동일인 — 중복 계정 생성 금지)
  //   4) qrchatUid 일치 (지갑조차 없는 예전 데이터 폴백 — 최후 폴백)
  // ───────────────────────────────────────────────────────────────
  const db = await getD1();

  let row: any = null;

  // 1) 지갑 + 닉네임 동시일치 (매칭키 — 최우선)
  row = await db
    .prepare(
      `SELECT * FROM "User" WHERE LOWER("securetQrUrl") = ? AND "nickname" = ? LIMIT 1`
    )
    .bind(wallet, nickname)
    .first();

  // 2) 지갑 + name 동시일치 (B회원 접미사 처리 흔적 흡수)
  if (!row) {
    row = await db
      .prepare(
        `SELECT * FROM "User" WHERE LOWER("securetQrUrl") = ? AND "name" = ? LIMIT 1`
      )
      .bind(wallet, nickname)
      .first();
  }
  // 3) 지갑 단독 일치 (같은 지갑이면 동일인)
  if (!row) {
    row = await db
      .prepare(`SELECT * FROM "User" WHERE LOWER("securetQrUrl") = ? LIMIT 1`)
      .bind(wallet)
      .first();
  }
  // 4) qrchatUid 일치 (지갑 데이터가 없는 최후 폴백)
  if (!row) {
    row = await db
      .prepare(`SELECT * FROM "User" WHERE "qrchatUid" = ? LIMIT 1`)
      .bind(qrchatUid)
      .first();
  }

  let user: any = row;

  // 찾았으면: 연동 판별에 필요한 3필드(qrchatUid/지갑/닉)를 채워 연결을 안정화한다.
  //   (기존 잔액/origin 은 절대 건드리지 않음)
  //
  //   ★★★ 2026-08-03 수정 (오로로 사건):
  //     기존엔 qrchatUid 도 "비어있을 때만" 채웠기 때문에, 옛 uid 가 박혀있으면
  //     새 uid 로 갱신이 안 됐다. 그 결과 큐알쳇 앱 재설치/재가입한 사용자는
  //     마이페이지 쿠키가 계속 0 원으로 표시됐다.
  //
  //     이번 수정으로 "지갑 동시일치" 로 계정을 찾은 경우, qrchatUid 를
  //     항상 SSO 값으로 갱신한다. 지갑이 동시일치 확인된 상태이므로
  //     계정 탈취 위험은 없다 (오히려 옛 uid 를 유지하는 것이 데이터 부정합).
  //     지갑이 비어있는 옛 데이터는 종전대로 "비어있을 때만" 채우는
  //     보수적 백필을 유지한다.
  if (user) {
    try {
      const sets: string[] = [];
      const binds: any[] = [];

      // ★ 매칭키(지갑) 동시일치 → qrchatUid 를 항상 SSO 값으로 정정 (오로로 자동복구).
      //   지갑이 없거나 다른 계정은 아래 "빈 값 보수적 백필" 로 처리.
      const userWallet = String(user.securetQrUrl || '').trim().toLowerCase();
      const walletMatched = !!userWallet && userWallet === wallet;

      if (walletMatched) {
        if (String(user.qrchatUid || '') !== qrchatUid) {
          sets.push(`"qrchatUid" = ?`);
          binds.push(qrchatUid);
        }
      } else if (!user.qrchatUid) {
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
        // 인메모리 반영
        if (walletMatched && String(user.qrchatUid || '') !== qrchatUid) {
          user.qrchatUid = qrchatUid;
        } else if (!user.qrchatUid) {
          user.qrchatUid = qrchatUid;
        }
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

  // ★★★ 2026-08-15 수정 (WebView 자동로그인 세션 유실 사건):
  //   큐알쳇 앱 WebView 는 큐알쳇 도메인 ↔ qrlive.io 크로스사이트다.
  //   SameSite=Lax 쿠키는 크로스사이트 fetch/XHR 요청에 실리지 않아,
  //   SSO 로 auth-token 을 심어도 바로구매/리뷰 API 가 "로그인 요구" 로 튕겼다.
  //   → 크로스사이트에서도 쿠키가 실리도록 SameSite=None; Secure 로 세팅한다.
  //   (SameSite=None 은 반드시 Secure 동반 필수 → 프로덕션 https 에서만 적용.
  //    로컬 http 개발환경은 None+Secure 가 거부되므로 lax 로 폴백)
  const isProd = process.env.NODE_ENV === 'production';
  const crossSiteCookie = {
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  };
  const cookieStore = await cookies();
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    ...crossSiteCookie,
  });
  cookieStore.set('user-role', user.role, {
    httpOnly: false,
    ...crossSiteCookie,
  });

  const { password: _pw, ...userSafe } = user as any;
  return { ok: true, status: 200, user: userSafe, token };
}
