/**
 * 자동 번역(Workers AI) 결과 D1 캐시
 *
 * 상품명/카테고리명 등 동적 텍스트를 Cloudflare Workers AI 로 번역한 결과를
 * D1 테이블에 캐시하여, 동일 텍스트를 반복 번역하지 않도록 한다.
 * 마이그레이션 스텝이 없으므로 CREATE TABLE IF NOT EXISTS 로 셀프 힐링. (멱등)
 */

let _translationTableEnsured = false;

export async function ensureTranslationTable(db: any): Promise<void> {
  if (_translationTableEnsured) return;
  if (!db) return;
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS "Translation" (
          "id" TEXT PRIMARY KEY,
          "sourceText" TEXT NOT NULL,
          "targetLocale" TEXT NOT NULL,
          "translatedText" TEXT NOT NULL,
          "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP
        )`
      )
      .run();
    // 조회 성능용 유니크 인덱스 (동일 원문+대상언어 1건)
    await db
      .prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS "Translation_src_locale_idx"
         ON "Translation" ("sourceText", "targetLocale")`
      )
      .run();
  } catch (e: any) {
    console.warn('[ensureTranslationTable] 생성 실패(무시):', String(e?.message || e || ''));
  } finally {
    _translationTableEnsured = true;
  }
}

/** 캐시에서 번역 조회 (여러 원문 일괄) → Map<sourceText, translatedText> */
export async function getCachedTranslations(
  db: any,
  texts: string[],
  targetLocale: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!db || texts.length === 0) return result;
  try {
    const placeholders = texts.map(() => '?').join(',');
    const rows: any = await db
      .prepare(
        `SELECT "sourceText", "translatedText" FROM "Translation"
         WHERE "targetLocale" = ? AND "sourceText" IN (${placeholders})`
      )
      .bind(targetLocale, ...texts)
      .all();
    const list: any[] = rows?.results || rows || [];
    for (const r of list) {
      if (r && r.sourceText != null) result.set(r.sourceText, r.translatedText);
    }
  } catch (e: any) {
    console.warn('[getCachedTranslations] 조회 실패(무시):', String(e?.message || e || ''));
  }
  return result;
}

/** 번역 결과 캐시에 저장 (멱등 - 이미 있으면 무시) */
export async function saveTranslations(
  db: any,
  entries: { sourceText: string; translatedText: string }[],
  targetLocale: string
): Promise<void> {
  if (!db || entries.length === 0) return;
  for (const e of entries) {
    try {
      const id = `${targetLocale}:${e.sourceText}`.slice(0, 400);
      await db
        .prepare(
          `INSERT OR IGNORE INTO "Translation"
           ("id", "sourceText", "targetLocale", "translatedText")
           VALUES (?, ?, ?, ?)`
        )
        .bind(id, e.sourceText, targetLocale, e.translatedText)
        .run();
    } catch {
      // 개별 저장 실패는 무시
    }
  }
}
