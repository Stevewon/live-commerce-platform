-- Product.supplyPrice (공급가) 컬럼 추가
-- 프로덕션 D1 에 마이그레이션 스텝이 없으므로, 앱 런타임의 ensureSupplyPriceColumn()
-- 셀프 힐링으로도 자동 추가되지만, 수동으로 미리 적용하려면 아래를 실행:
--   wrangler d1 execute qrlive-production --remote --file=scripts/add_supplyprice_column.sql
-- Float? (nullable) → SQLite REAL
ALTER TABLE "Product" ADD COLUMN "supplyPrice" REAL;
