/**
 * KISPG (키스정보통신) 결제 연동 라이브러리
 * 가맹점 연동 가이드 v1.1.11 기반
 * 
 * 지원 결제수단: CARD(신용카드), BANK(계좌이체), VACNT(가상계좌), HP(휴대폰결제)
 */

// ─── 환경변수 ───
// 개발환경: testapi.kispg.co.kr / 운영환경: api.kispg.co.kr
function getKispgHost(): string {
  const mode = process.env.KISPG_MODE;
  console.log('[KISPG] MODE:', mode, '| MID:', process.env.KISPG_MID || '(default)');
  return mode === 'production'
    ? 'https://api.kispg.co.kr'
    : 'https://testapi.kispg.co.kr';
}

export function getKispgAuthUrl(): string {
  return `${getKispgHost()}/v2/auth`;
}
export function getKispgPaymentUrl(): string {
  return `${getKispgHost()}/v2/payment`;
}
export function getKispgCancelUrl(): string {
  return `${getKispgHost()}/v2/cancel`;
}

// 레거시 호환
export const KISPG_AUTH_URL = process.env.KISPG_MODE === 'production'
  ? 'https://api.kispg.co.kr/v2/auth'
  : 'https://testapi.kispg.co.kr/v2/auth';

// 가맹점 정보
export const KISPG_MID = process.env.KISPG_MID || 'kistest00m';
export const KISPG_MERCHANT_KEY = process.env.KISPG_MERCHANT_KEY || '2d6ECGhR1pg/1QGE1lcRI4awsWEgshjEyI8UgYslLPJSuNeyPTkdrT8XWARezvDTUJClWQWhjxzBbu7AsuLZqg==';

// ─── ediDate 생성 (yyyymmddhhmmss) ───
export function generateEdiDate(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

// ─── SHA-256 해시 (Cloudflare Workers 호환) ───
export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── encData 생성 ───
// 결제요청: mid + ediDate + goodsAmt + merchantKey → SHA-256 hex
export async function generateEncData(params: {
  mid?: string;
  ediDate: string;
  goodsAmt: string;
  merchantKey?: string;
}): Promise<string> {
  const {
    mid = KISPG_MID,
    ediDate,
    goodsAmt,
    merchantKey = KISPG_MERCHANT_KEY,
  } = params;
  const raw = mid + ediDate + goodsAmt + merchantKey;
  return sha256Hex(raw);
}

// ─── 결제 취소용 encData 생성 ───
// 취소요청: mid + ediDate + canAmt + merchantKey → SHA-256 hex
export async function generateCancelEncData(params: {
  mid?: string;
  ediDate: string;
  canAmt: string;
  merchantKey?: string;
}): Promise<string> {
  const {
    mid = KISPG_MID,
    ediDate,
    canAmt,
    merchantKey = KISPG_MERCHANT_KEY,
  } = params;
  const raw = mid + ediDate + canAmt + merchantKey;
  return sha256Hex(raw);
}

// ─── 결제 인증 요청 파라미터 생성 ───
export interface KispgAuthParams {
  ordNo: string;          // 주문번호
  goodsNm: string;        // 상품명
  goodsAmt: number;       // 결제금액
  ordNm: string;          // 주문자명
  ordTel?: string;        // 주문자 전화번호
  ordEmail?: string;      // 주문자 이메일
  returnUrl: string;      // 결제 결과 수신 URL
  payMethod?: string;     // 결제수단 (card, bank, vacnt, hp)
  model?: string;         // 결제창 모드 (1: 기본)
  trxCd?: string;         // 0: 일반결제
  currencyType?: string;  // KRW
  mbsReserved?: string;   // 가맹점 예비 필드 (주문 ID 등 전달용)
}

export async function buildAuthFormData(params: KispgAuthParams) {
  const mid = KISPG_MID;
  const ediDate = generateEdiDate();
  // KISPG는 정수 금액만 허용 (원 단위, 소수점 불가)
  const goodsAmt = Math.round(params.goodsAmt).toString();
  const encData = await generateEncData({ ediDate, goodsAmt });

  console.log('[KISPG buildAuthFormData] mid:', mid, 'ediDate:', ediDate, 'goodsAmt:', goodsAmt, 'ordNo:', params.ordNo);

  return {
    mid,
    model: params.model || '1',
    payMethod: params.payMethod || 'card',
    goodsNm: params.goodsNm,
    goodsAmt,
    ordNo: params.ordNo,
    ordNm: params.ordNm,
    ordTel: params.ordTel || '01000000000',
    ordEmail: params.ordEmail || '',
    returnUrl: params.returnUrl,
    trxCd: params.trxCd || '0',
    currencyType: params.currencyType || 'KRW',
    ediDate,
    encData,
    charset: 'utf-8',
    mbsReserved: params.mbsReserved || '',
  };
}

// ─── 결제 승인 API 호출 ───
export interface KispgApproveParams {
  mid?: string;
  tid: string;            // KISPG 트랜잭션 ID (인증 결과에서 수신)
  goodsAmt: number;       // 결제 금액
}

export async function approveKispgPayment(params: KispgApproveParams) {
  const mid = params.mid || KISPG_MID;
  const ediDate = generateEdiDate();
  // KISPG는 정수 금액만 허용
  const goodsAmt = Math.round(params.goodsAmt).toString();
  const encData = await generateEncData({ mid, ediDate, goodsAmt });

  const paymentUrl = getKispgPaymentUrl();
  console.log('[KISPG Approve] URL:', paymentUrl, 'mid:', mid, 'tid:', params.tid, 'goodsAmt:', goodsAmt);

  const body = new URLSearchParams({
    mid,
    tid: params.tid,
    goodsAmt,
    ediDate,
    encData,
    charset: 'utf-8',
  });

  const response = await fetch(paymentUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
    body: body.toString(),
  });

  const responseText = await response.text();
  console.log('[KISPG Approve] HTTP Status:', response.status, 'Response:', responseText.substring(0, 500));

  if (!response.ok) {
    throw new Error(`KISPG 결제 승인 HTTP 오류: ${response.status} - ${responseText.substring(0, 200)}`);
  }

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error('[KISPG Approve] JSON 파싱 실패:', responseText.substring(0, 500));
    throw new Error(`KISPG 결제 승인 응답 파싱 실패: ${responseText.substring(0, 200)}`);
  }

  console.log('[KISPG Approve] resultCd:', data.resultCd, 'resultMsg:', data.resultMsg);

  // resultCd "0000" → 성공
  if (data.resultCd !== '0000') {
    throw new Error(data.resultMsg || `KISPG 결제 승인 실패 (${data.resultCd})`);
  }

  return data;
}

// ─── 결제 취소 API 호출 ───
export interface KispgCancelParams {
  payMethod: string;      // card, bank 등
  tid: string;            // 트랜잭션 ID
  canAmt: number;         // 취소 금액
  canId?: string;         // 취소자 ID
  canNm?: string;         // 취소자 이름
  canMsg?: string;        // 취소 사유
}

export async function cancelKispgPayment(params: KispgCancelParams) {
  const mid = KISPG_MID;
  const ediDate = generateEdiDate();
  // KISPG는 정수 금액만 허용
  const canAmt = Math.round(params.canAmt).toString();
  const encData = await generateCancelEncData({ mid, ediDate, canAmt });

  const cancelUrl = getKispgCancelUrl();
  console.log('[KISPG Cancel] URL:', cancelUrl, 'mid:', mid, 'tid:', params.tid, 'canAmt:', canAmt);

  const body = new URLSearchParams({
    payMethod: params.payMethod,
    mid,
    tid: params.tid,
    canAmt,
    canId: params.canId || 'admin',
    canNm: params.canNm || '관리자',
    canMsg: params.canMsg || '고객 요청에 의한 취소',
    ediDate,
    encData,
    charset: 'utf-8',
  });

  const response = await fetch(cancelUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
    body: body.toString(),
  });

  const responseText = await response.text();
  console.log('[KISPG Cancel] HTTP Status:', response.status, 'Response:', responseText.substring(0, 500));

  if (!response.ok) {
    throw new Error(`KISPG 결제 취소 HTTP 오류: ${response.status} - ${responseText.substring(0, 200)}`);
  }

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error('[KISPG Cancel] JSON 파싱 실패:', responseText.substring(0, 500));
    throw new Error(`KISPG 결제 취소 응답 파싱 실패: ${responseText.substring(0, 200)}`);
  }

  console.log('[KISPG Cancel] resultCd:', data.resultCd, 'resultMsg:', data.resultMsg);

  if (data.resultCd !== '0000') {
    throw new Error(data.resultMsg || `KISPG 결제 취소 실패 (${data.resultCd})`);
  }

  return data;
}

// ─── 인증 결과 검증 ───
// returnUrl로 POST된 인증 결과의 encData 검증
export async function verifyAuthResult(params: {
  resultCd: string;
  tid: string;
  amt: string;
  ediDate: string;
  encData: string;
}): Promise<boolean> {
  // 성공 코드 확인 (결제수단별로 다른 성공 코드: 0000, 3001, 4000, A000, 7001 등)
  const authSuccessCodes = ['0000', '3001', '4000', 'A000', '7001', '8001', 'V000'];
  if (!authSuccessCodes.includes(params.resultCd) && !(params.tid && params.tid.length > 0)) {
    return false;
  }
  // encData 검증: mid + ediDate + amt + merchantKey 의 SHA-256
  const expectedEnc = await generateEncData({
    ediDate: params.ediDate,
    goodsAmt: params.amt,
  });
  return expectedEnc === params.encData;
}
