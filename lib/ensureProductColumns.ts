/**
 * Product 테이블 스키마 자동 보정 (셀프 힐링 마이그레이션)
 *
 * 프로덕션 D1 에는 별도 마이그레이션 스텝이 없으므로, 상품 등록/수정 관련
 * 최초 접근 시 supplyPrice(공급가) 컬럼이 없으면 자동으로 추가한다. (멱등)
 * - 이미 컬럼이 있으면 "duplicate column name" 에러가 나며, 이는 무시한다.
 */

let _supplyPriceColumnEnsured = false;
let _productIndexesEnsured = false;
let _orderPaymentColumnsEnsured = false;

// D1 바인딩을 가져오는 함수 (lib/prisma.ts 와 동일 패턴)
async function getD1(): Promise<any> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    return (ctx.env as any).DB;
  } catch {
    return null;
  }
}

/**
 * Product.supplyPrice 컬럼이 존재하도록 보장 (없으면 ALTER TABLE 로 추가).
 * 프로세스 당 1회만 실제 시도. 실패해도 상품 등록 자체는 진행되도록 예외를 삼킨다.
 */
export async function ensureSupplyPriceColumn(db?: any): Promise<void> {
  if (_supplyPriceColumnEnsured) return;
  const d1 = db || (await getD1());
  if (!d1) return;
  try {
    const cols: any = await d1.prepare(`PRAGMA table_info("Product")`).all();
    const rows: any[] = cols?.results || cols || [];
    const hasSupply = Array.isArray(rows) && rows.some((r) => r && r.name === 'supplyPrice');
    if (!hasSupply) {
      try {
        // Float? → SQLite REAL, NULL 허용
        await d1.prepare(`ALTER TABLE "Product" ADD COLUMN "supplyPrice" REAL`).run();
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (!/duplicate column|already exists/i.test(msg)) {
          console.warn('[ensureSupplyPriceColumn] ALTER 실패(무시):', msg);
        }
      }
    }
  } catch (e: any) {
    console.warn('[ensureSupplyPriceColumn] PRAGMA 확인 실패(무시):', String(e?.message || e || ''));
  } finally {
    _supplyPriceColumnEnsured = true;
  }
}

/**
 * Product 목록 조회 성능 인덱스 보장 (없으면 CREATE INDEX IF NOT EXISTS).
 * 프로세스 당 1회만 시도. 실패해도 조회 자체는 진행되도록 예외를 삼킨다.
 * - isActive/categoryId/isFeatured/createdAt/price: 목록 필터·정렬에 사용
 */
export async function ensureProductIndexes(db?: any): Promise<void> {
  if (_productIndexesEnsured) return;
  const d1 = db || (await getD1());
  if (!d1) return;
  const statements = [
    `CREATE INDEX IF NOT EXISTS "Product_isActive_idx" ON "Product" ("isActive")`,
    `CREATE INDEX IF NOT EXISTS "Product_categoryId_idx" ON "Product" ("categoryId")`,
    `CREATE INDEX IF NOT EXISTS "Product_isFeatured_idx" ON "Product" ("isFeatured")`,
    `CREATE INDEX IF NOT EXISTS "Product_createdAt_idx" ON "Product" ("createdAt")`,
    `CREATE INDEX IF NOT EXISTS "Product_price_idx" ON "Product" ("price")`,
  ];
  try {
    for (const sql of statements) {
      try {
        await d1.prepare(sql).run();
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (!/already exists/i.test(msg)) {
          console.warn('[ensureProductIndexes] 인덱스 생성 실패(무시):', msg);
        }
      }
    }
  } finally {
    _productIndexesEnsured = true;
  }
}

/**
 * Order 테이블 병행결제(쿠키+현금) 기록용 컬럼 보장.
 * - paidQkey: 이 주문에서 쿠키(QKEY)로 결제한 개수 (INTEGER, default 0)
 * - paidKrw:  이 주문에서 현금(KRW)으로 결제한 금액 (INTEGER, default 0)
 * 프로세스 당 1회만 시도. 이미 있으면 duplicate 에러를 무시한다. (멱등)
 */
export async function ensureOrderPaymentColumns(db?: any): Promise<void> {
  if (_orderPaymentColumnsEnsured) return;
  const d1 = db || (await getD1());
  if (!d1) return;
  try {
    const cols: any = await d1.prepare(`PRAGMA table_info("Order")`).all();
    const rows: any[] = cols?.results || cols || [];
    const names = new Set((Array.isArray(rows) ? rows : []).map((r) => r && r.name));
    const toAdd: string[] = [];
    if (!names.has('paidQkey')) toAdd.push(`ALTER TABLE "Order" ADD COLUMN "paidQkey" INTEGER DEFAULT 0`);
    if (!names.has('paidKrw')) toAdd.push(`ALTER TABLE "Order" ADD COLUMN "paidKrw" INTEGER DEFAULT 0`);
    for (const sql of toAdd) {
      try {
        await d1.prepare(sql).run();
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (!/duplicate column|already exists/i.test(msg)) {
          console.warn('[ensureOrderPaymentColumns] ALTER 실패(무시):', msg);
        }
      }
    }
  } catch (e: any) {
    console.warn('[ensureOrderPaymentColumns] PRAGMA 확인 실패(무시):', String(e?.message || e || ''));
  } finally {
    _orderPaymentColumnsEnsured = true;
  }
}
