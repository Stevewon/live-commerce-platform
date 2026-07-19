-- ============================================================================
-- v1.0.22 KISPG PG 중단 + QKEY/현금 잔액 결제 시스템 도입 D1 마이그레이션 (멱등 구간)
-- 실행: npx wrangler d1 execute qrlive-production --remote --file=scripts/v1_0_22_balance_migration.sql
-- ----------------------------------------------------------------------------
-- ⚠️ 실행 순서:
--    1) scripts/v1_0_22_add_balance_columns.sql  (User 잔액 컬럼 추가 — 최초 1회)
--    2) scripts/v1_0_22_balance_migration.sql    (이 파일 — 여러 번 실행해도 안전)
--    이 파일의 모든 문장은 IF NOT EXISTS / 조건부 UPDATE 로 멱등(idempotent)합니다.
-- ============================================================================

-- 1) 충전 신청 테이블
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

-- 2) 잔액 증감 이력 테이블 (감사 로그)
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

-- 3) 기존 KISPG PENDING 주문 일괄 자동 CANCELLED 처리 (사장님 확정)
--    - status='PENDING' 이고 paymentMethod 가 KISPG 관련(카드/결제대기/신용카드 등)인 주문
--    - v1.0.22 배포 이후 신규 주문은 KRW/QKEY 잔액 결제만 가능하므로 잔존 PENDING 은 무의미
--    - 이미 auto-cancel 처리된 주문은 제외(LIKE '%v1.0.22 auto-cancel%')하여 멱등 보장
UPDATE "Order"
SET
  "status" = 'CANCELLED',
  "paymentMethod" = COALESCE("paymentMethod", '') || ' [v1.0.22 auto-cancel]',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  "status" = 'PENDING'
  AND ("paymentMethod" IS NULL OR "paymentMethod" NOT LIKE '%v1.0.22 auto-cancel%')
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
