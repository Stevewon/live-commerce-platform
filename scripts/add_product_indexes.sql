-- Product 목록 조회 성능 인덱스 추가
-- 프로덕션 D1 에 마이그레이션 스텝이 없으므로, 앱 런타임의 ensureProductIndexes()
-- 셀프 힐링으로도 자동 생성되지만, 수동으로 미리 적용하려면 아래를 실행:
--   wrangler d1 execute qrlive-production --remote --file=scripts/add_product_indexes.sql
-- 목록 필터(isActive/categoryId/isFeatured)·정렬(createdAt/price)에 사용
CREATE INDEX IF NOT EXISTS "Product_isActive_idx" ON "Product" ("isActive");
CREATE INDEX IF NOT EXISTS "Product_categoryId_idx" ON "Product" ("categoryId");
CREATE INDEX IF NOT EXISTS "Product_isFeatured_idx" ON "Product" ("isFeatured");
CREATE INDEX IF NOT EXISTS "Product_createdAt_idx" ON "Product" ("createdAt");
CREATE INDEX IF NOT EXISTS "Product_price_idx" ON "Product" ("price");
