-- ============================================================================
-- v1.0.22 KISPG PG 중단 + QKEY/현금 잔액 결제 시스템 도입 D1 마이그레이션
-- 실행: npx wrangler d1 execute qrlive-production --remote --file=scripts/v1_0_22_balance_migration.sql
-- ============================================================================

-- 1) User 테이블에 잔액 컬럼 추가 (이미 있으면 스킵)
--    KRW: 원화 정수, QKEY: 쿠키 정수 (1 QKEY = 10원)
ALTER TABLE "User" ADD COLUMN "krwBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "qkeyBalance" INTEGER NOT NULL DEFAULT 0;

-- 2) 충전 신청 테이블
CREATE TABLE IF NOT EXISTS "BalanceRequest" (
  "id"            TEXT PRIMARY KEY,
  "userId"        TEXT NOT NULL,
  "type"          TEXT NOT NULL, -- 'KRW_DEPOSIT' | 'QKEY_DEPOSIT'
  "amount"        INTEGER NOT NULL,
  "depositorName" TEXT,
  "txHash"        TEXT,
  "senderAddress" TEXT,
  "status"        TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED
  "adminNote"     TEXT,
  "approvedBy"    TEXT,
  "approvedAt"    DATETIME,
  "rejectedAt"    DATETIME,
  "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "BalanceRequest_userId_idx"    ON "BalanceRequest"("userId");
CREATE INDEX IF NOT EXISTS "BalanceRequest_status_idx"    ON "BalanceRequest"("status");
CREATE INDEX IF NOT EXISTS "BalanceRequest_type_idx"      ON "BalanceRequest"("type");
CREATE INDEX IF NOT EXISTS "BalanceRequest_createdAt_idx" ON "BalanceRequest"("createdAt");

-- 3) 잔액 증감 이력 테이블 (감사 로그)
CREATE TABLE IF NOT EXISTS "BalanceLedger" (
  "id"                TEXT PRIMARY KEY,
  "userId"            TEXT NOT NULL,
  "currency"          TEXT NOT NULL, -- 'KRW' | 'QKEY'
  "amount"            INTEGER NOT NULL, -- 양수=충전/환불, 음수=차감/사용
  "balanceAfter"      INTEGER NOT NULL,
  "reason"            TEXT NOT NULL,
  "relatedOrderId"    TEXT,
  "relatedRequestId"  TEXT,
  "createdAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "BalanceLedger_userId_idx"           ON "BalanceLedger"("userId");
CREATE INDEX IF NOT EXISTS "BalanceLedger_currency_idx"         ON "BalanceLedger"("currency");
CREATE INDEX IF NOT EXISTS "BalanceLedger_createdAt_idx"        ON "BalanceLedger"("createdAt");
CREATE INDEX IF NOT EXISTS "BalanceLedger_relatedOrderId_idx"   ON "BalanceLedger"("relatedOrderId");
CREATE INDEX IF NOT EXISTS "BalanceLedger_relatedRequestId_idx" ON "BalanceLedger"("relatedRequestId");

-- 4) 기존 KISPG PENDING 주문 일괄 자동 CANCELLED 처리 (사장님 확정)
--    - status='PENDING' 이고 paymentMethod 가 KISPG 관련(카드/결제대기/신용카드 등)인 주문
--    - v1.0.22 배포 이후 신규 주문은 KRW/QKEY 잔액 결제만 가능하므로 잔존 PENDING 은 무의미
UPDATE "Order"
SET
  "status" = 'CANCELLED',
  "paymentMethod" = COALESCE("paymentMethod", '') || ' [v1.0.22 auto-cancel]',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  "status" = 'PENDING'
  AND (
    "paymentMethod" IS NULL
    OR "paymentMethod" = ''
    OR "paymentMethod" = '결제대기'
    OR "paymentMethod" = '결제창진입'
    OR "paymentMethod" = '신용카드'
    OR "paymentMethod" LIKE '%card%'
    OR "paymentMethod" LIKE '%KISPG%'
    OR "paymentMethod" LIKE '%kispg%'
  );

-- 마이그레이션 완료 확인 쿼리 (수동 실행용)
-- SELECT COUNT(*) AS total_users, SUM("krwBalance") AS total_krw, SUM("qkeyBalance") AS total_qkey FROM "User";
-- SELECT COUNT(*) AS pending_requests FROM "BalanceRequest" WHERE "status"='PENDING';
-- SELECT COUNT(*) AS cancelled_orders FROM "Order" WHERE "paymentMethod" LIKE '%v1.0.22 auto-cancel%';
