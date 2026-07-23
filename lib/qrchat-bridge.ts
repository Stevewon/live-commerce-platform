/**
 * QRChat 연동 브릿지 클라이언트 (쇼핑몰 서버 → QRChat Cloud Functions)
 * ============================================================================
 * QRChat(Firebase) 측 Cloud Functions 4종을 HMAC-SHA256 서명으로 호출한다.
 *   - verifyQrliveSso   : 앱이 발급한 SSO 토큰 검증 + 1회성 소비 → 사용자 확인
 *   - spendQkeyForQrlive: QRChat QKEY 잔액에서 직접 차감 (사장님 확정 (가) 방식)
 *   - linkQrchatWallet  : A 회원 지갑+닉네임으로 QRChat uid 매칭 (지갑연결용)
 *
 * ⚠️ 보안: 아래 두 공유키는 서버(Server Component / Route Handler)에서만 사용.
 *          절대 클라이언트 번들/브라우저에 노출 금지.
 *   - QRLIVE_BRIDGE_SECRET : 쇼핑몰 서버 ↔ Functions HMAC 서명 공유키 (양측 동일)
 *   - QRCHAT_FUNCTIONS_BASE_URL : Functions 배포 베이스 URL
 *
 * ⚠️ HMAC 은 Web Crypto(subtle) 로 구현 → Cloudflare Workers/Node 양쪽 호환.
 */

// ---------------------------------------------------------------------------
// 설정 (환경변수 → wrangler secret / .dev.vars)
// ---------------------------------------------------------------------------
function getBridgeSecret(): string {
  const s = process.env.QRLIVE_BRIDGE_SECRET;
  if (!s) {
    throw new Error('[qrchat-bridge] QRLIVE_BRIDGE_SECRET 미설정');
  }
  return s;
}

function getFunctionsBaseUrl(): string {
  const base =
    process.env.QRCHAT_FUNCTIONS_BASE_URL ||
    'https://asia-northeast3-qrchat-b7a67.cloudfunctions.net';
  return base.replace(/\/+$/, '');
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 (hex) — Functions 측 crypto.createHmac 와 동일한 결과
// ---------------------------------------------------------------------------
async function hmacHex(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  const bytes = new Uint8Array(sigBuf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

// 지갑/닉네임 정규화 — Functions 측 normWallet/normNick 와 동일하게 맞춰야 함
export function normWallet(w?: string | null): string {
  return String(w || '').trim().toLowerCase();
}
export function normNick(n?: string | null): string {
  return String(n || '').trim();
}

// ---------------------------------------------------------------------------
// 공통 POST 헬퍼
// ---------------------------------------------------------------------------
async function postJson(fnName: string, body: Record<string, any>): Promise<any> {
  const url = `${getFunctionsBaseUrl()}/${fnName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = { ok: false, error: 'invalid_response', status: res.status };
  }
  if (!res.ok || json?.ok === false) {
    return {
      ok: false,
      status: res.status,
      error: json?.error || `http_${res.status}`,
      raw: json,
    };
  }
  return json;
}

// ---------------------------------------------------------------------------
// 1) SSO 토큰 검증 + 1회 소비
//    sig = HMAC(BRIDGE_SECRET, ssoToken)
//    반환: { ok, uid, nickname, walletAddress, qkeyBalance, origin }
// ---------------------------------------------------------------------------
export interface SsoVerifyResult {
  ok: boolean;
  uid?: string;
  nickname?: string;
  walletAddress?: string;
  qkeyBalance?: number;
  origin?: string;
  error?: string;
  status?: number;
}

export async function verifyQrliveSso(ssoToken: string): Promise<SsoVerifyResult> {
  const token = String(ssoToken || '').trim();
  if (!token) return { ok: false, error: 'missing_token' };
  const sig = await hmacHex(getBridgeSecret(), token);
  return postJson('verifyQrliveSso', { ssoToken: token, sig });
}

// ---------------------------------------------------------------------------
// 2) QKEY 직접 차감 (사장님 확정 (가) — Firebase 잔액에서 바로 차감)
//    sig = HMAC(BRIDGE_SECRET, `${uid}|${wallet}|${nick}|${amountQkey}|${orderId}|${idemKey}`)
//    반환: { ok, newBalance, txId, idempotent }
// ---------------------------------------------------------------------------
export interface SpendQkeyParams {
  uid: string;
  wallet: string;
  nick: string;
  amountQkey: number;
  orderId: string;
  idemKey: string;
}
export interface SpendQkeyResult {
  ok: boolean;
  newBalance?: number;
  txId?: string;
  idempotent?: boolean;
  error?: string;
  status?: number;
}

export async function spendQkeyForQrlive(p: SpendQkeyParams): Promise<SpendQkeyResult> {
  const uid = String(p.uid || '').trim();
  const wallet = normWallet(p.wallet);
  const nick = normNick(p.nick);
  const amountQkey = Math.trunc(Number(p.amountQkey) || 0);
  const orderId = String(p.orderId || '').trim();
  const idemKey = String(p.idemKey || '').trim();

  if (!uid || !wallet || !nick || amountQkey <= 0 || !orderId || !idemKey) {
    return { ok: false, error: 'invalid_params' };
  }
  const signMsg = `${uid}|${wallet}|${nick}|${amountQkey}|${orderId}|${idemKey}`;
  const sig = await hmacHex(getBridgeSecret(), signMsg);
  return postJson('spendQkeyForQrlive', {
    uid,
    wallet,
    nick,
    amountQkey,
    orderId,
    idemKey,
    sig,
  });
}

// ---------------------------------------------------------------------------
// 3) A 회원 지갑연결: 지갑+닉네임으로 QRChat uid 조회
//    sig = HMAC(BRIDGE_SECRET, `${wallet}|${nick}`)
//    반환: { ok, uid, nickname, walletAddress, qkeyBalance }
//    (0건→no_match 404, 2건 이상→ambiguous 409)
// ---------------------------------------------------------------------------
export interface LinkWalletResult {
  ok: boolean;
  uid?: string;
  nickname?: string;
  walletAddress?: string;
  qkeyBalance?: number;
  error?: string;
  status?: number;
}

export async function linkQrchatWallet(
  wallet: string,
  nick: string
): Promise<LinkWalletResult> {
  const w = normWallet(wallet);
  const n = normNick(nick);
  if (!w || !n) return { ok: false, error: 'invalid_params' };
  const sig = await hmacHex(getBridgeSecret(), `${w}|${n}`);
  return postJson('linkQrchatWallet', { wallet: w, nick: n, sig });
}

// ---------------------------------------------------------------------------
// 4) QRChat 직접 로그인 (쇼핑몰 웹 로그인창에 큐알쳇 닉/비번 그대로 입력)
//    sig = HMAC(BRIDGE_SECRET, `${nickname}|${password}`)
//    반환: { ok, uid, nickname, walletAddress, qkeyBalance, origin }
//    (계정없음→account_not_found 404, 비번틀림→password_mismatch 401,
//     차단→banned 403, 지갑/닉없음→wallet_or_nickname_missing 422)
//    ⚠️ 비번이 전송되므로 서버(Route Handler)에서만 호출.
// ---------------------------------------------------------------------------
export interface DirectLoginResult {
  ok: boolean;
  uid?: string;
  nickname?: string;
  walletAddress?: string;
  qkeyBalance?: number;
  origin?: string;
  error?: string;
  status?: number;
}

export async function qrchatDirectLogin(
  nickname: string,
  password: string
): Promise<DirectLoginResult> {
  const n = normNick(nickname);
  const p = String(password != null ? password : '');
  if (!n || !p) return { ok: false, error: 'invalid_params' };
  const sig = await hmacHex(getBridgeSecret(), `${n}|${p}`);
  return postJson('qrchatDirectSso', { nickname: n, password: p, sig });
}

// ---------------------------------------------------------------------------
// 5) QRChat 실시간 QKEY 잔액 조회 (마이페이지 표시용)
//    sig = HMAC(BRIDGE_SECRET, uid)
//    반환: { ok, uid, nickname, walletAddress, qkeyBalance, banned }
//    B 회원(origin=QRCHAT)의 실제 잔액은 큐알쳇 Firebase 에 있으므로,
//    쇼핑몰 마이페이지가 이 값을 읽어와 표시한다.
// ---------------------------------------------------------------------------
export interface QkeyBalanceResult {
  ok: boolean;
  uid?: string;
  nickname?: string;
  walletAddress?: string;
  qkeyBalance?: number;
  banned?: boolean;
  error?: string;
  status?: number;
}

export async function getQrchatQkeyBalance(
  uid: string
): Promise<QkeyBalanceResult> {
  const u = String(uid || '').trim();
  if (!u) return { ok: false, error: 'invalid_params' };
  const sig = await hmacHex(getBridgeSecret(), u);
  return postJson('getQrchatQkeyBalance', { uid: u, sig });
}
