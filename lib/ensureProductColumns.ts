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
let _userQrchatColumnsEnsured = false;
let _overseasBlockedColumnEnsured = false;
let _orderIndexesEnsured = false;

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
/**
 * Product.overseasBlocked(해외배송 불가) 컬럼이 존재하도록 보장 (없으면 ADD COLUMN).
 * 기본값 0(false) = 해외배송 가능. 1 = 해외(일본) 상품에서 제외.
 * 프로세스 당 1회만 시도. 실패해도 상품 등록/조회는 진행되도록 예외 삼킴.
 */
export async function ensureOverseasBlockedColumn(db?: any): Promise<void> {
  if (_overseasBlockedColumnEnsured) return;
  const d1 = db || (await getD1());
  if (!d1) return;
  try {
    const cols: any = await d1.prepare(`PRAGMA table_info("Product")`).all();
    const rows: any[] = cols?.results || cols || [];
    const has = Array.isArray(rows) && rows.some((r) => r && r.name === 'overseasBlocked');
    if (!has) {
      try {
        await d1.prepare(`ALTER TABLE "Product" ADD COLUMN "overseasBlocked" INTEGER NOT NULL DEFAULT 0`).run();
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (!/duplicate column|already exists/i.test(msg)) {
          console.warn('[ensureOverseasBlockedColumn] ALTER 실패(무시):', msg);
        }
      }
    }
  } catch (e: any) {
    console.warn('[ensureOverseasBlockedColumn] PRAGMA 확인 실패(무시):', String(e?.message || e || ''));
  } finally {
    _overseasBlockedColumnEnsured = true;
  }
}

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
 * [2026-08-06 PERF] 주문/정산 관련 조회 성능 인덱스 보장 (셀프 힐링).
 *
 * 프로덕션 D1 의 Order/OrderItem/Settlement/PartnerProduct 테이블에는
 * FK/필터/정렬 컬럼 인덱스가 전혀 없어(주문번호 unique 제외) 어드민의
 * status/createdAt/userId/partnerId 필터·집계가 매번 풀스캔이었다.
 * Product 인덱스와 동일하게 CREATE INDEX IF NOT EXISTS 로 런타임 자동 생성한다.
 * - Order: status(상태필터), createdAt(기간/정렬), userId(회원별), partnerId(정산),
 *          복합 (status,createdAt) 는 대시보드/리포트의 "기간+상태" 집계 가속.
 * - OrderItem: orderId(주문 조인), productId(상품별 판매 집계) — charts/analytics.
 * - Settlement: partnerId, status — 정산 목록 필터.
 * - PartnerProduct: partnerId — 스토어/파트너 상품 목록.
 * 프로세스 당 1회만 시도. 실패해도 조회 자체는 진행되도록 예외를 삼킨다. (멱등)
 */
export async function ensureOrderIndexes(db?: any): Promise<void> {
  if (_orderIndexesEnsured) return;
  const d1 = db || (await getD1());
  if (!d1) return;
  const statements = [
    `CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order" ("status")`,
    `CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order" ("createdAt")`,
    `CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON "Order" ("userId")`,
    `CREATE INDEX IF NOT EXISTS "Order_partnerId_idx" ON "Order" ("partnerId")`,
    `CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order" ("status", "createdAt")`,
    `CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem" ("orderId")`,
    `CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem" ("productId")`,
    `CREATE INDEX IF NOT EXISTS "Settlement_partnerId_idx" ON "Settlement" ("partnerId")`,
    `CREATE INDEX IF NOT EXISTS "Settlement_status_idx" ON "Settlement" ("status")`,
    `CREATE INDEX IF NOT EXISTS "PartnerProduct_partnerId_idx" ON "PartnerProduct" ("partnerId")`,
  ];
  try {
    for (const sql of statements) {
      try {
        await d1.prepare(sql).run();
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (!/already exists/i.test(msg)) {
          console.warn('[ensureOrderIndexes] 인덱스 생성 실패(무시):', msg);
        }
      }
    }
  } finally {
    _orderIndexesEnsured = true;
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

/**
 * [QRChat 연동] User 테이블에 origin / qrchatUid 컬럼 보장.
 *   - origin:    가입 출처 ("QRLIVE" | "QRCHAT"). 기본값 "QRLIVE" (기존 A 회원 보호).
 *   - qrchatUid: QRChat 측 UID. B 회원 매칭 + A 회원 지갑연결에 사용. UNIQUE.
 * 프로세스 당 1회만 시도. 이미 있으면 duplicate 에러를 무시한다. (멱등)
 * ⚠️ 기존 A 회원은 origin 이 자동으로 "QRLIVE" 로 채워져 로그인/결제에 영향 없음.
 */
export async function ensureUserQrchatColumns(db?: any): Promise<void> {
  if (_userQrchatColumnsEnsured) return;
  const d1 = db || (await getD1());
  if (!d1) return;
  try {
    const cols: any = await d1.prepare(`PRAGMA table_info("User")`).all();
    const rows: any[] = cols?.results || cols || [];
    const names = new Set((Array.isArray(rows) ? rows : []).map((r) => r && r.name));
    const toAdd: string[] = [];
    if (!names.has('origin')) {
      toAdd.push(`ALTER TABLE "User" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'QRLIVE'`);
    }
    if (!names.has('qrchatUid')) {
      // UNIQUE 제약은 ALTER 로 못 붙이므로 컬럼 추가 후 UNIQUE INDEX 로 보장
      toAdd.push(`ALTER TABLE "User" ADD COLUMN "qrchatUid" TEXT`);
    }
    for (const sql of toAdd) {
      try {
        await d1.prepare(sql).run();
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (!/duplicate column|already exists/i.test(msg)) {
          console.warn('[ensureUserQrchatColumns] ALTER 실패(무시):', msg);
        }
      }
    }
    // qrchatUid UNIQUE 인덱스 (NULL 은 SQLite 에서 UNIQUE 충돌 안 남)
    try {
      await d1
        .prepare(`CREATE UNIQUE INDEX IF NOT EXISTS "User_qrchatUid_key" ON "User" ("qrchatUid")`)
        .run();
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      if (!/already exists/i.test(msg)) {
        console.warn('[ensureUserQrchatColumns] UNIQUE 인덱스 생성 실패(무시):', msg);
      }
    }
  } catch (e: any) {
    console.warn('[ensureUserQrchatColumns] PRAGMA 확인 실패(무시):', String(e?.message || e || ''));
  } finally {
    _userQrchatColumnsEnsured = true;
  }
}
