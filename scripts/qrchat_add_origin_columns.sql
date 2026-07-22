-- ============================================================================
-- QRChat 연동: User.origin / User.qrchatUid 컬럼 추가 — 비-멱등 구간
-- 실행: npx wrangler d1 execute qrlive-production --remote --file=scripts/qrchat_add_origin_columns.sql
-- ----------------------------------------------------------------------------
-- ⚠️ SQLite ALTER TABLE ADD COLUMN 은 멱등하지 않음 → 이미 있으면 duplicate 에러.
--    (앱 런타임에서 lib/ensureProductColumns.ts::ensureUserQrchatColumns() 가
--     동일 작업을 셀프힐링으로 수행하므로, 이 파일은 최초 1회 수동 적용용.)
--
-- 사장님 확정 규칙:
--   - origin:    가입 출처. "QRLIVE"(A 회원, 기존 유지) | "QRCHAT"(B 회원, QRChat 유입)
--   - qrchatUid: QRChat 측 UID. QKEY 직접 차감 매칭 키. A/B 절대 자동병합 금지.
-- ============================================================================

ALTER TABLE "User" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'QRLIVE';
ALTER TABLE "User" ADD COLUMN "qrchatUid" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_qrchatUid_key" ON "User" ("qrchatUid");
