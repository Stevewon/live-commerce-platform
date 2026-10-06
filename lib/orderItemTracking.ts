/**
 * [상품별 송장] 주문 상품(OrderItem)마다 택배사/운송장번호를 따로 저장
 *
 * 배경: 상품별 출고 물류창고가 달라 한 주문에 송장번호가 여러 개 생김.
 *       주문 단위 1개 송장(Order.trackingNumber)에 합쳐 넣으면 구매자가 혼동.
 *
 * 별도 테이블 "OrderItemTracking" 에 저장한다. (Prisma 스키마 밖 — D1 raw SQL)
 *  - OrderItem 에 컬럼을 추가하면 컬럼 생성 전 Prisma 조회가 전부 실패할 위험이 있어 분리.
 *  - 최초 접근 시 CREATE TABLE IF NOT EXISTS 로 자동 생성 (멱등)
 *  - 주문 단위 송장(Order.trackingCompany/trackingNumber)은 기존 화면/알림 호환용으로 계속 유지
 */
import { getD1 } from '@/lib/balance';

export interface ItemTracking {
  orderItemId: string;
  trackingCompany: string;
  trackingNumber: string;
}

let _tableEnsured = false;

export async function ensureOrderItemTrackingTable(db?: any): Promise<any> {
  const d1 = db || (await getD1());
  if (!d1 || _tableEnsured) return d1;
  try {
    await d1.prepare(
      `CREATE TABLE IF NOT EXISTS "OrderItemTracking" (
        "orderItemId" TEXT PRIMARY KEY,
        "orderId" TEXT NOT NULL,
        "trackingCompany" TEXT,
        "trackingNumber" TEXT,
        "updatedAt" TEXT
      )`
    ).run();
    await d1.prepare(
      `CREATE INDEX IF NOT EXISTS "OrderItemTracking_orderId_idx" ON "OrderItemTracking" ("orderId")`
    ).run();
    _tableEnsured = true;
  } catch (e: any) {
    console.warn('[ensureOrderItemTrackingTable] 실패(무시):', String(e?.message || e || ''));
  }
  return d1;
}

/** 주문 ID 목록 → { orderItemId: {trackingCompany, trackingNumber} } */
export async function getItemTrackingMap(orderIds: string[]): Promise<Record<string, ItemTracking>> {
  const map: Record<string, ItemTracking> = {};
  const ids = Array.from(new Set(orderIds.filter(Boolean)));
  if (ids.length === 0) return map;
  try {
    const d1 = await ensureOrderItemTrackingTable();
    if (!d1) return map;
    // D1 바인딩 개수 제한 대비 100개씩 나눠 조회
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const res: any = await d1
        .prepare(
          `SELECT "orderItemId","trackingCompany","trackingNumber" FROM "OrderItemTracking" WHERE "orderId" IN (${chunk.map(() => '?').join(',')})`
        )
        .bind(...chunk)
        .all();
      const rows: any[] = res?.results || res || [];
      for (const r of rows) {
        if (r?.orderItemId && r.trackingNumber) {
          map[r.orderItemId] = {
            orderItemId: r.orderItemId,
            trackingCompany: r.trackingCompany || '',
            trackingNumber: r.trackingNumber || '',
          };
        }
      }
    }
  } catch (e: any) {
    console.warn('[getItemTrackingMap] 조회 실패(무시):', String(e?.message || e || ''));
  }
  return map;
}

/** 주문 목록의 items[] 에 itemTracking 필드를 붙여 반환 (없으면 null) */
export async function attachItemTrackings<T extends { id: string; items?: any[] | null }>(orders: T[]): Promise<T[]> {
  const map = await getItemTrackingMap(orders.map((o) => o.id));
  return orders.map((o) => ({
    ...o,
    items: Array.isArray(o.items)
      ? o.items.map((it: any) => ({ ...it, itemTracking: map[it.id] || null }))
      : o.items,
  }));
}

/**
 * 상품별 송장 저장. 송장번호가 빈 항목은 삭제(초기화).
 * validItemIds: 이 주문에 속한 OrderItem id (다른 주문 상품 덮어쓰기 방지)
 */
export async function saveItemTrackings(orderId: string, list: ItemTracking[], validItemIds: string[]): Promise<number> {
  const d1 = await ensureOrderItemTrackingTable();
  if (!d1) throw new Error('DB 연결 실패');
  const valid = new Set(validItemIds);
  const now = new Date().toISOString();
  let saved = 0;
  for (const t of list) {
    if (!t?.orderItemId || !valid.has(t.orderItemId)) continue;
    const company = String(t.trackingCompany || '').trim();
    const number = String(t.trackingNumber || '').trim();
    if (!number) {
      await d1.prepare(`DELETE FROM "OrderItemTracking" WHERE "orderItemId" = ?`).bind(t.orderItemId).run();
      continue;
    }
    await d1
      .prepare(
        `INSERT INTO "OrderItemTracking" ("orderItemId","orderId","trackingCompany","trackingNumber","updatedAt")
         VALUES (?,?,?,?,?)
         ON CONFLICT("orderItemId") DO UPDATE SET
           "trackingCompany" = excluded."trackingCompany",
           "trackingNumber" = excluded."trackingNumber",
           "updatedAt" = excluded."updatedAt"`
      )
      .bind(t.orderItemId, orderId, company, number, now)
      .run();
    saved++;
  }
  return saved;
}
