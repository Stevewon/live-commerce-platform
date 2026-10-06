/**
 * [옵션별 공급가] 옵션(변형)마다 공급가(매입원가)를 따로 저장 — 어드민 전용
 *
 * 예) 전기매트 싱글 공급가 50,000 / 더블 공급가 56,000
 *
 * 별도 테이블 "VariantSupplyPrice" 에 저장한다. (Prisma 스키마 밖 — D1 raw SQL)
 *  - ProductVariant 는 상품 수정 시 "전체 삭제 후 재생성"되어 id 가 바뀌므로
 *    (상품 id + 옵션값) 으로 키를 잡는다.
 *  - 공개 상품 API 는 이 테이블을 읽지 않으므로 공급가가 구매자에게 노출되지 않음.
 */
import { getD1 } from '@/lib/balance';

let _tableEnsured = false;

async function ensureTable(): Promise<any> {
  const d1 = await getD1();
  if (!d1 || _tableEnsured) return d1;
  try {
    await d1.prepare(
      `CREATE TABLE IF NOT EXISTS "VariantSupplyPrice" (
        "productId" TEXT NOT NULL,
        "optionKey" TEXT NOT NULL,
        "supplyPrice" REAL NOT NULL,
        "updatedAt" TEXT,
        PRIMARY KEY ("productId", "optionKey")
      )`
    ).run();
    _tableEnsured = true;
  } catch (e: any) {
    console.warn('[VariantSupplyPrice] 테이블 생성 실패(무시):', String(e?.message || e || ''));
  }
  return d1;
}

/** 옵션값(JSON 문자열/객체) → 순서 무관한 고정 키 */
export function optionKey(optionValues: any): string {
  try {
    const obj = typeof optionValues === 'string' ? JSON.parse(optionValues) : optionValues;
    if (!obj || typeof obj !== 'object') return String(optionValues ?? '');
    const entries = Object.entries(obj)
      .map(([k, v]) => [String(k).trim(), String(v ?? '').trim()] as [string, string])
      .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(entries);
  } catch {
    return String(optionValues ?? '');
  }
}

/** 상품 id 목록 → Map<"productId|optionKey", 공급가> */
export async function getVariantSupplyMap(productIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (ids.length === 0) return map;
  try {
    const d1 = await ensureTable();
    if (!d1) return map;
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const res: any = await d1
        .prepare(
          `SELECT "productId","optionKey","supplyPrice" FROM "VariantSupplyPrice" WHERE "productId" IN (${chunk.map(() => '?').join(',')})`
        )
        .bind(...chunk)
        .all();
      for (const r of (res?.results || res || []) as any[]) {
        map.set(`${r.productId}|${r.optionKey}`, Number(r.supplyPrice));
      }
    }
  } catch (e: any) {
    console.warn('[VariantSupplyPrice] 조회 실패(무시):', String(e?.message || e || ''));
  }
  return map;
}

/** 상품의 옵션별 공급가 전체 교체 (빈 값은 저장 안 함 → 상품 공급가 사용) */
export async function saveVariantSupplyPrices(
  productId: string,
  variants: Array<{ optionValues: any; supplyPrice?: any }>
): Promise<void> {
  const d1 = await ensureTable();
  if (!d1) return;
  await d1.prepare(`DELETE FROM "VariantSupplyPrice" WHERE "productId" = ?`).bind(productId).run();
  const now = new Date().toISOString();
  for (const v of variants) {
    const raw = v?.supplyPrice;
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    const sp = parseFloat(String(raw).replace(/[^\d.]/g, ''));
    if (!Number.isFinite(sp)) continue;
    await d1
      .prepare(
        `INSERT OR REPLACE INTO "VariantSupplyPrice" ("productId","optionKey","supplyPrice","updatedAt") VALUES (?,?,?,?)`
      )
      .bind(productId, optionKey(v.optionValues), sp, now)
      .run();
  }
}

/** 상품 응답의 variants[] 에 supplyPrice 첨부 (어드민 상품 수정 화면용) */
export async function attachVariantSupplyPrices(product: any): Promise<any> {
  if (!product?.id || !Array.isArray(product.variants) || product.variants.length === 0) return product;
  const map = await getVariantSupplyMap([product.id]);
  return {
    ...product,
    variants: product.variants.map((v: any) => ({
      ...v,
      supplyPrice: map.get(`${product.id}|${optionKey(v.optionValues)}`) ?? null,
    })),
  };
}
