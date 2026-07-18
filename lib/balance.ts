/**
 * [v1.0.22] 잔액 결제 시스템 공통 유틸
 *
 * - 사장님 확정 룰:
 *   - 1 QKEY = 10원 환율 (고정)
 *   - KRW: 무통장입금 (IBK기업 992-026554-01-015 (주)퀀타리움)
 *   - QKEY: 퀀타리움 자체 블록체인, 수령지갑 0xE0c166B147a742E4FbCf5e5BCf73aCA631f14f0e
 *
 * - description 안전룰 (사장님 영구 명령 2026-05-11):
 *   사용자 노출 안전 한국어 문구만 사용. reason/adminNote/marker 절대 금지.
 */

// ─── 환율 상수 ───
export const QKEY_TO_KRW = 10; // 1 QKEY = 10 원
export const KRW_TO_QKEY = 1 / QKEY_TO_KRW;

// ─── 금액 변환 유틸 ───

/** KRW → QKEY 환산 (내림) */
export function krwToQkey(krw: number): number {
  if (!Number.isFinite(krw)) return 0;
  return Math.floor(krw / QKEY_TO_KRW);
}

/** QKEY → KRW 환산 */
export function qkeyToKrw(qkey: number): number {
  if (!Number.isFinite(qkey)) return 0;
  return Math.floor(qkey * QKEY_TO_KRW);
}

// ─── 회사 정보 상수 (프론트 표시용) ───

export const COMPANY_BANK_INFO = {
  bankName: 'IBK기업은행',
  accountNumber: '992-026554-01-015',
  accountHolder: '주식회사 퀀타리움',
} as const;

export const COMPANY_QKEY_WALLET = {
  address: '0xE0c166B147a742E4FbCf5e5BCf73aCA631f14f0e',
  network: '퀀타리움 자체 블록체인 (Quantarium Chain)',
} as const;

// ─── ID 생성 (uuid v4 폴백) ───
export function newId(): string {
  try {
    if (typeof globalThis.crypto !== 'undefined' && (globalThis.crypto as any).randomUUID) {
      return (globalThis.crypto as any).randomUUID();
    }
  } catch {}
  // 폴백: Math.random 기반 (Cloudflare Workers 환경 대비)
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
}

// ─── 잔액 원자 차감/증감 (D1 native) ───

export type Currency = 'KRW' | 'QKEY';

/**
 * 잔액 원자 조정 + BalanceLedger 기록
 *
 * @param db      D1Database
 * @param userId  사용자 ID
 * @param currency 'KRW' | 'QKEY'
 * @param delta   양수(충전) / 음수(차감)
 * @param reason  사용자 노출 안전 문구만 (예: '무통장입금 충전', '주문 결제', '주문 취소 환불')
 * @param relatedOrderId   연관 주문 ID (nullable)
 * @param relatedRequestId 연관 BalanceRequest ID (nullable)
 *
 * @returns { newBalance: number, ledgerId: string }
 *
 * 실패 케이스:
 *   - delta 가 음수인데 현재 잔액 부족 → throw Error('잔액이 부족합니다')
 *   - 사용자 없음 → throw Error('사용자를 찾을 수 없습니다')
 */
export async function adjustBalance(
  db: any,
  userId: string,
  currency: Currency,
  delta: number,
  reason: string,
  relatedOrderId: string | null = null,
  relatedRequestId: string | null = null
): Promise<{ newBalance: number; ledgerId: string }> {
  if (!userId) throw new Error('userId가 필요합니다');
  if (!Number.isFinite(delta) || delta === 0) throw new Error('delta가 유효하지 않습니다');
  if (!['KRW', 'QKEY'].includes(currency)) throw new Error('currency가 유효하지 않습니다');
  if (!reason || reason.trim().length === 0) throw new Error('reason이 필요합니다');

  const column = currency === 'KRW' ? 'krwBalance' : 'qkeyBalance';

  // 1) 현재 잔액 조회
  const userRow = await db
    .prepare(`SELECT "id", "${column}" AS "balance" FROM "User" WHERE "id" = ? LIMIT 1`)
    .bind(userId)
    .first();

  if (!userRow) throw new Error('사용자를 찾을 수 없습니다');

  const currentBalance = Number(userRow.balance) || 0;
  const newBalance = currentBalance + delta;

  if (newBalance < 0) {
    const shortName = currency === 'KRW' ? 'KRW 잔액' : 'QKEY 잔액';
    throw new Error(`${shortName}이 부족합니다 (현재: ${currentBalance.toLocaleString()}, 필요: ${(-delta).toLocaleString()})`);
  }

  // 2) User 잔액 업데이트
  await db
    .prepare(`UPDATE "User" SET "${column}" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?`)
    .bind(newBalance, userId)
    .run();

  // 3) BalanceLedger INSERT
  const ledgerId = newId();
  await db
    .prepare(
      `INSERT INTO "BalanceLedger"
       ("id", "userId", "currency", "amount", "balanceAfter", "reason", "relatedOrderId", "relatedRequestId", "createdAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
    .bind(ledgerId, userId, currency, delta, newBalance, reason, relatedOrderId, relatedRequestId)
    .run();

  return { newBalance, ledgerId };
}

/**
 * 사용자 잔액 조회 (KRW + QKEY 동시)
 */
export async function getUserBalance(
  db: any,
  userId: string
): Promise<{ krwBalance: number; qkeyBalance: number }> {
  const row = await db
    .prepare(`SELECT "krwBalance", "qkeyBalance" FROM "User" WHERE "id" = ? LIMIT 1`)
    .bind(userId)
    .first();

  if (!row) return { krwBalance: 0, qkeyBalance: 0 };

  return {
    krwBalance: Number(row.krwBalance) || 0,
    qkeyBalance: Number(row.qkeyBalance) || 0,
  };
}

/**
 * D1 바인딩 획득 헬퍼
 */
export async function getD1(): Promise<any> {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare');
  const ctx = await getCloudflareContext();
  return (ctx.env as any).DB;
}
