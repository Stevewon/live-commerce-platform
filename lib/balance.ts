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

// ─── QTA 적립 상수 (사장님 확정 룰) ───
// - 구매 금액의 5% 를 QTA 로 적립
// - 100원 = 1 QTA 환산
// - 예: 20,000원 구매 → 5% = 1,000원 → ÷100 = 10 QTA
export const QTA_TO_KRW = 100; // 1 QTA = 100 원
export const QTA_ACCRUAL_RATE = 0.05; // 구매 금액의 5% 적립

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

/**
 * 구매 금액(KRW)으로부터 적립될 QTA 계산
 * - 구매금액 × 5% → 적립원(KRW)
 * - 적립원 ÷ 100 → QTA (내림)
 * 예: 20,000 × 0.05 = 1,000 → 1,000 / 100 = 10 QTA
 */
export function qtaFromKrw(krw: number): number {
  if (!Number.isFinite(krw) || krw <= 0) return 0;
  const rewardKrw = krw * QTA_ACCRUAL_RATE;
  return Math.floor(rewardKrw / QTA_TO_KRW);
}

/** QTA → KRW 환산 */
export function qtaToKrw(qta: number): number {
  if (!Number.isFinite(qta)) return 0;
  return Math.floor(qta * QTA_TO_KRW);
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

export type Currency = 'KRW' | 'QKEY' | 'QTA';

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
  if (!['KRW', 'QKEY', 'QTA'].includes(currency)) throw new Error('currency가 유효하지 않습니다');
  if (!reason || reason.trim().length === 0) throw new Error('reason이 필요합니다');

  const column =
    currency === 'KRW' ? 'krwBalance' : currency === 'QKEY' ? 'qkeyBalance' : 'qtaBalance';

  // 1) 현재 잔액 조회
  const userRow = await db
    .prepare(`SELECT "id", "${column}" AS "balance" FROM "User" WHERE "id" = ? LIMIT 1`)
    .bind(userId)
    .first();

  if (!userRow) throw new Error('사용자를 찾을 수 없습니다');

  const currentBalance = Number(userRow.balance) || 0;
  const newBalance = currentBalance + delta;

  if (newBalance < 0) {
    const shortName =
      currency === 'KRW' ? 'KRW 잔액' : currency === 'QKEY' ? 'QKEY 잔액' : 'QTA 적립';
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
): Promise<{ krwBalance: number; qkeyBalance: number; qtaBalance: number }> {
  // qtaBalance 컬럼이 아직 없을 수 있으므로 안전하게 조회 (없으면 0)
  try {
    const row = await db
      .prepare(`SELECT "krwBalance", "qkeyBalance", "qtaBalance" FROM "User" WHERE "id" = ? LIMIT 1`)
      .bind(userId)
      .first();

    if (!row) return { krwBalance: 0, qkeyBalance: 0, qtaBalance: 0 };

    return {
      krwBalance: Number(row.krwBalance) || 0,
      qkeyBalance: Number(row.qkeyBalance) || 0,
      qtaBalance: Number(row.qtaBalance) || 0,
    };
  } catch {
    // qtaBalance 컬럼 부재 등 → KRW/QKEY 만 조회하고 QTA=0
    const row = await db
      .prepare(`SELECT "krwBalance", "qkeyBalance" FROM "User" WHERE "id" = ? LIMIT 1`)
      .bind(userId)
      .first();
    if (!row) return { krwBalance: 0, qkeyBalance: 0, qtaBalance: 0 };
    return {
      krwBalance: Number(row.krwBalance) || 0,
      qkeyBalance: Number(row.qkeyBalance) || 0,
      qtaBalance: 0,
    };
  }
}

/**
 * D1 바인딩 획득 헬퍼
 */
export async function getD1(): Promise<any> {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare');
  const ctx = await getCloudflareContext();
  return (ctx.env as any).DB;
}

// ─── QTA 컬럼 자동 보정 (셀프 힐링 마이그레이션) ───
// 프로덕션 D1 에 별도 마이그레이션 스텝이 없으므로, QTA 적립 관련
// 최초 접근 시 qtaBalance 컬럼이 없으면 자동으로 추가한다. (멱등)
// - 이미 컬럼이 있으면 "duplicate column name" 에러가 나며, 이는 무시한다.
let _qtaColumnEnsured = false;

/**
 * User.qtaBalance 컬럼이 존재하도록 보장 (없으면 ALTER TABLE 로 추가).
 * D1 바인딩(db)을 인자로 받는다. 프로세스 당 1회만 실제 시도.
 */
export async function ensureQtaColumn(db: any): Promise<void> {
  if (_qtaColumnEnsured) return;
  if (!db) return;
  try {
    // 컬럼 존재 여부 확인
    const cols: any = await db.prepare(`PRAGMA table_info("User")`).all();
    const rows: any[] = cols?.results || cols || [];
    const hasQta = Array.isArray(rows) && rows.some((r) => r && r.name === 'qtaBalance');
    if (!hasQta) {
      try {
        await db
          .prepare(`ALTER TABLE "User" ADD COLUMN "qtaBalance" INTEGER NOT NULL DEFAULT 0`)
          .run();
      } catch (e: any) {
        // 이미 존재하는 경우(duplicate column) 등은 무시
        const msg = String(e?.message || e || '');
        if (!/duplicate column|already exists/i.test(msg)) {
          // 다른 에러는 로그만 남기고 진행 (적립 실패해도 주문은 성립되어야 함)
          console.warn('[ensureQtaColumn] ALTER 실패(무시):', msg);
        }
      }
    }
  } catch (e: any) {
    console.warn('[ensureQtaColumn] PRAGMA 확인 실패(무시):', String(e?.message || e || ''));
  } finally {
    _qtaColumnEnsured = true;
  }
}
