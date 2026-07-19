-- ============================================================================
-- v1.0.22 잔액 컬럼 추가 (User 테이블) — 비-멱등 구간
-- 실행: npx wrangler d1 execute qrlive-production --remote --file=scripts/v1_0_22_add_balance_columns.sql
-- ----------------------------------------------------------------------------
-- ⚠️ 주의: SQLite 의 ALTER TABLE ADD COLUMN 은 멱등하지 않습니다.
--    이미 컬럼이 존재하면 "duplicate column name" 에러가 납니다.
--    → 이 파일은 최초 1회만 실행하거나, 배포 워크플로에서 에러를 허용(continue-on-error)합니다.
-- ============================================================================

ALTER TABLE "User" ADD COLUMN "krwBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "qkeyBalance" INTEGER NOT NULL DEFAULT 0;
