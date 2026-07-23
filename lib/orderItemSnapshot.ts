/**
 * OrderItem 상품 스냅샷 컬럼 자동 보정 + 백필 (셀프 힐링 마이그레이션)
 *
 * 배경 (사장님 확정 룰):
 *  - OrderItem 은 원래 productId 로 Product 를 join 해서 상품명을 표시했다.
 *  - 상품이 삭제/변경되면 join 결과가 null → 어드민/주문내역에 "상품 정보 없음" 표시 → 배송 불가.
 *  - 정상 쇼핑몰(쿠팡/토스)처럼 주문 시점 상품명·썸네일을 OrderItem 에 스냅샷 저장한다.
 *
 * 이 파일은:
 *  1) OrderItem 에 productName / productThumbnail 컬럼이 없으면 ALTER TABLE 로 추가 (멱등)
 *  2) 스냅샷이 비어있는 기존 OrderItem 을 Product 값으로 1회 백필 (멱등, 프로세스당 1회)
 *
 * D1 별도 마이그레이션 스텝이 없으므로 최초 접근 시 자동 보정한다.
 */

let _snapshotColumnsEnsured = false;
let _backfilled = false;

/**
 * OrderItem.productName / productThumbnail 컬럼 존재 보장 (없으면 추가).
 * 프로세스당 1회만 실제 시도. (멱등)
 */
export async function ensureOrderItemSnapshotColumns(db: any): Promise<void> {
  if (_snapshotColumnsEnsured) return;
  if (!db) return;
  try {
    const cols: any = await db.prepare(`PRAGMA table_info("OrderItem")`).all();
    const rows: any[] = cols?.results || cols || [];
    const names = new Set(
      (Array.isArray(rows) ? rows : []).map((r) => r && r.name).filter(Boolean)
    );

    if (!names.has('productName')) {
      try {
        await db.prepare(`ALTER TABLE "OrderItem" ADD COLUMN "productName" TEXT`).run();
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (!/duplicate column|already exists/i.test(msg)) {
          console.warn('[ensureOrderItemSnapshotColumns] productName ALTER 실패(무시):', msg);
        }
      }
    }
    if (!names.has('productThumbnail')) {
      try {
        await db.prepare(`ALTER TABLE "OrderItem" ADD COLUMN "productThumbnail" TEXT`).run();
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (!/duplicate column|already exists/i.test(msg)) {
          console.warn('[ensureOrderItemSnapshotColumns] productThumbnail ALTER 실패(무시):', msg);
        }
      }
    }
  } catch (e: any) {
    console.warn(
      '[ensureOrderItemSnapshotColumns] PRAGMA 확인 실패(무시):',
      String(e?.message || e || '')
    );
  } finally {
    _snapshotColumnsEnsured = true;
  }
}

/**
 * 스냅샷이 비어있는 기존 OrderItem 을 Product 값으로 백필 (멱등, 프로세스당 1회).
 *  - productName 이 NULL/'' 인 행만 대상
 *  - Product 가 아직 존재하는 행은 실제 상품명으로 채움
 *  - Product 가 이미 삭제되어 매칭 안 되는 행은 그대로 둠(스냅샷 없음 → 조회 fallback 문구 처리)
 */
export async function backfillOrderItemSnapshots(db: any): Promise<void> {
  if (_backfilled) return;
  if (!db) return;
  await ensureOrderItemSnapshotColumns(db);
  try {
    // Product join 으로 한 번에 백필 (SQLite UPDATE ... FROM 미지원 → 상관 서브쿼리 사용)
    await db
      .prepare(
        `UPDATE "OrderItem"
           SET "productName" = (
                 SELECT p."name" FROM "Product" p WHERE p."id" = "OrderItem"."productId"
               )
         WHERE ("productName" IS NULL OR "productName" = '')
           AND EXISTS (
                 SELECT 1 FROM "Product" p WHERE p."id" = "OrderItem"."productId"
               )`
      )
      .run();
    await db
      .prepare(
        `UPDATE "OrderItem"
           SET "productThumbnail" = (
                 SELECT p."thumbnail" FROM "Product" p WHERE p."id" = "OrderItem"."productId"
               )
         WHERE ("productThumbnail" IS NULL OR "productThumbnail" = '')
           AND EXISTS (
                 SELECT 1 FROM "Product" p WHERE p."id" = "OrderItem"."productId"
               )`
      )
      .run();
  } catch (e: any) {
    console.warn('[backfillOrderItemSnapshots] 백필 실패(무시):', String(e?.message || e || ''));
  } finally {
    _backfilled = true;
  }
}
