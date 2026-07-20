-- ============================================================================
-- 카테고리 4종 추가: 주방(kitchen) / 생활(living) / 건강식품(health) / 취미(hobby)
-- 실행: npx wrangler d1 execute qrlive-production --remote --file=scripts/add_4_categories.sql
-- ----------------------------------------------------------------------------
-- INSERT OR IGNORE 로 slug 중복 시 무시 (멱등). id 는 고정 UUID 사용.
-- ============================================================================

INSERT OR IGNORE INTO "Category" ("id", "name", "slug", "description", "createdAt", "updatedAt")
VALUES
  ('cat-kitchen-0001-0001-000000000001', '주방', 'kitchen', '주방용품, 조리도구, 식기', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-living-0001-0001-000000000002', '생활', 'living', '생활용품, 청소, 수납', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-health-0001-0001-000000000003', '건강식품', 'health', '건강기능식품, 비타민, 영양제', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-hobby-0001-0001-000000000004', '취미', 'hobby', '취미용품, 문구, 완구', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
