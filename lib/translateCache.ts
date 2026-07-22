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

// m2m100 언어 코드 매핑 (앱 Locale → 모델 언어코드)
const SERVER_LANG_MAP: Record<string, string> = {
  ko: 'ko', en: 'en', ja: 'ja', zh: 'zh', vi: 'vi', th: 'th',
};

/**
 * 서버 측 일괄 번역: D1 캐시 우선 → 미캐시만 Workers AI → 캐시 저장.
 * API 라우트가 응답에 번역본을 곧바로 실어 보낼 때 사용(클라이언트 async 번역 타이밍 이슈 제거).
 * 실패/미지원 시 원문을 그대로 매핑해 화면이 깨지지 않도록 한다.
 *
 * @returns Map<원문, 번역문>
 */
export async function translateTextsServer(
  env: any,
  texts: string[],
  target: string,
  source = 'ko'
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniqueTexts = Array.from(
    new Set((texts || []).map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean))
  ).slice(0, 200);

  // 원문 언어거나 미지원 언어면 원문 그대로
  if (!target || target === source || !SERVER_LANG_MAP[target]) {
    for (const t of uniqueTexts) out.set(t, t);
    return out;
  }
  if (uniqueTexts.length === 0) return out;

  const db = env?.DB;
  const ai = env?.AI;

  // 1) 캐시 조회
  if (db) {
    try {
      await ensureTranslationTable(db);
      const cached = await getCachedTranslations(db, uniqueTexts, target);
      for (const [k, v] of cached) out.set(k, v);
    } catch { /* 무시 */ }
  }

  // 2) 미캐시만 AI 번역
  const toTranslate = uniqueTexts.filter((t) => !out.has(t));
  if (toTranslate.length > 0 && ai) {
    const newly: { sourceText: string; translatedText: string }[] = [];
    for (const text of toTranslate) {
      try {
        const res: any = await ai.run('@cf/meta/m2m100-1.2b', {
          text,
          source_lang: SERVER_LANG_MAP[source] || 'ko',
          target_lang: SERVER_LANG_MAP[target],
        });
        const translated = (res && (res.translated_text || res.result?.translated_text)) || text;
        out.set(text, translated);
        if (translated && translated !== text) newly.push({ sourceText: text, translatedText: translated });
      } catch {
        out.set(text, text);
      }
    }
    if (db && newly.length > 0) {
      try { await saveTranslations(db, newly, target); } catch { /* 무시 */ }
    }
  } else {
    for (const t of toTranslate) if (!out.has(t)) out.set(t, t);
  }

  return out;
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
