-- ============================================================================
-- QTA 적립 시스템: User.qtaBalance 컬럼 추가 — 비-멱등 구간
-- 실행: npx wrangler d1 execute qrlive-production --remote --file=scripts/qta_add_qtabalance_column.sql
-- ----------------------------------------------------------------------------
-- ⚠️ 주의: SQLite 의 ALTER TABLE ADD COLUMN 은 멱등하지 않습니다.
--    이미 컬럼이 존재하면 "duplicate column name" 에러가 납니다.
--    → 이 파일은 최초 1회만 실행하거나, 배포 시 에러를 허용(continue-on-error)합니다.
--
-- QTA 적립 규칙 (사장님 확정):
--   - 구매 금액의 5% 를 QTA 로 적립
--   - 100원 = 1 QTA 환산 (예: 20,000원 × 5% = 1,000원 → ÷100 = 10 QTA)
--   - 주문 취소/반환 시 적립분 자동 회수
-- ============================================================================

ALTER TABLE "User" ADD COLUMN "qtaBalance" INTEGER NOT NULL DEFAULT 0;
