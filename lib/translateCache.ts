/**
 * 자동 번역(Workers AI) 결과 D1 캐시
 *
 * 상품명/카테고리명 등 동적 텍스트를 Cloudflare Workers AI 로 번역한 결과를
 * D1 테이블에 캐시하여, 동일 텍스트를 반복 번역하지 않도록 한다.
 * 마이그레이션 스텝이 없으므로 CREATE TABLE IF NOT EXISTS 로 셀프 힐링. (멱등)
 */

let _translationTableEnsured = false;

/**
 * 번역 캐시 버전. 번역 엔진/프롬프트를 크게 바꿔 과거 캐시를 통째로 무효화해야 할 때 올린다.
 * 저장/조회 시 대상 로케일에 접미사로 붙여(예: 'ja' → 'ja@v2') 이전 버전 캐시를 자연스럽게 우회한다.
 * v2: m2m100/8B → Llama3.3-70B/Gemma3 체인으로 교체(상품명 헛번역 대량 무효화).
 * v3: 긴 상세설명 토큰 확장 + 한글 잔존 15% 기준 강화 + 최선후보 채택(원문 노출 방지).
 */
export const TRANSLATION_CACHE_VERSION = 'v3';

/** 캐시 저장/조회에 쓰는 로케일 키(버전 접미사 포함). */
export function cacheLocale(target: string): string {
  return `${target}@${TRANSLATION_CACHE_VERSION}`;
}

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

// 사람이 읽는 언어명 (LLM 프롬프트용)
const LANG_NAME: Record<string, string> = {
  ko: 'Korean', en: 'English', ja: 'Japanese',
  zh: 'Chinese (Simplified)', vi: 'Vietnamese', th: 'Thai',
};

// 문자 계열 판별 헬퍼
function hasJapanese(s: string): boolean { return /[\u3040-\u30FF\u4E00-\u9FFF]/.test(s); }
function hasCJKIdeograph(s: string): boolean { return /[\u4E00-\u9FFF]/.test(s); }

// 번역문에서 한글이 차지하는 비율(공백 제외). 낮을수록 번역이 잘 된 것.
function hangulRatio(s: string): number {
  const compact = s.replace(/\s/g, '');
  if (!compact.length) return 0;
  const hangul = (compact.match(/[\uAC00-\uD7A3]/g) || []).length;
  return hangul / compact.length;
}

// 같은 짧은 토큰이 무의미하게 반복되는지(예: "メッセージメッセージ") 감지
//   - 3회+ 연속 반복이면 무조건 헛소리
//   - 2회 반복이라도 그 반복 블록이 전체의 60% 이상이면 헛소리(예: 토큰 2배 복제)
function hasSillyRepetition(s: string): boolean {
  const t = s.trim();
  if (/(.{2,10}?)\1{2,}/.test(t)) return true; // 3회 이상 연속 반복
  const m = t.match(/(.{2,12}?)\1{1,}/);        // 2회 이상 연속 반복
  if (m && m[0].length >= t.length * 0.6) return true;
  return false;
}

// 번역 결과가 "명백히 깨졌는지" 검사 → 깨졌으면 원문 유지(+캐시 저장 안 함)
//   상품명 등 복잡한 텍스트에서 번역 모델이 엉뚱한 문장을 뱉는 경우를 방어한다.
export function isBrokenTranslation(source: string, translated: string, target: string): boolean {
  if (!translated || typeof translated !== 'string') return true;
  const t = translated.trim();
  if (!t) return true;
  // 원문과 완전히 동일하면(번역 안 됨) 실패로 보지 않고 그대로 사용하므로 여기선 통과 처리
  if (t === source.trim()) return false;
  // LLM 이 지시문/따옴표/설명을 덧붙이는 경우 방어
  if (/^(translation|번역|sure|here|의역|直訳|の翻訳|翻訳|here is|here's|the translation)[:：\s]/i.test(t)) return true;
  // 무의미한 반복(같은 토큰 3회+) → 헛소리
  if (hasSillyRepetition(t)) return true;
  // 대상 언어 문자 검사 + 한글 잔존 검사 (잔존 한글은 번역 결함)
  const hRatio = hangulRatio(t);
  if (target === 'ja') {
    // 일본어 번역인데 일본어 문자(가나/한자)가 전혀 없으면 실패
    if (!hasJapanese(t)) return true;
    // 한글이 15% 초과로 남으면 미번역 조각이 많은 것으로 간주 → 실패(재시도/폴백)
    if (hRatio > 0.15) return true;
  } else if (target === 'zh') {
    if (!hasCJKIdeograph(t)) return true;
    if (hRatio > 0.15) return true;
  } else if (target === 'ko') {
    // ko 타겟은 사용하지 않지만 방어
  } else {
    // en/vi/th 등: 번역문에 한글이 남으면 원문 유출 → 실패
    if (hRatio > 0.15) return true;
  }
  // 숫자 보존 검사: 원문에 있던 아라비아 숫자가 번역문에서 완전히 사라지면(수량/인분 등 왜곡) 실패
  const srcNums = (source.match(/\d+/g) || []);
  if (srcNums.length > 0) {
    const dstNums = (t.match(/\d+/g) || []);
    if (srcNums.length >= 2 && dstNums.length === 0) return true;
  }
  // 길이 폭주(원문 대비 4배 초과)면 헛소리 생성으로 간주
  if (t.length > Math.max(40, source.length * 4)) return true;
  return false;
}

// 프롬프트 기반 LLM 번역 1회 시도 (모델 ID 지정)
async function llmTranslateOnce(
  ai: any, model: string, text: string, srcName: string, dstName: string, target: string
): Promise<string> {
  const sys =
    `You are a professional Korean e-commerce translator. Translate the user's product text from ${srcName} to ${dstName}. ` +
    `Rules:\n` +
    `- Output ONLY the translated text. No quotes, no explanation, no notes, no romanization, no original Korean text.\n` +
    `- CRITICAL: The ENTIRE output MUST be written in ${dstName}. Do NOT leave ANY Korean (Hangul) word untranslated. Translate every single Korean word, including food/ingredient names (e.g. 막국수→막국수 in ${dstName} script, 들기름→sesame/perilla oil, 메밀→buckwheat).\n` +
    `- Preserve numbers, units, quantities (e.g. 2인분→2 servings), and keep bracket structures like [ ] ( ).\n` +
    `- A proper brand name inside [ ] may stay as-is only if it is truly untranslatable.\n` +
    `- Keep it natural for an online shopping product listing. Do not add or drop information.`;
  // 입력 길이에 비례해 출력 토큰 확보 (긴 상세설명이 잘리지 않도록). 대략 글자수*2 + 여유.
  const maxTokens = Math.min(2000, Math.max(300, Math.ceil(text.length * 2.2) + 64));
  const res: any = await ai.run(model, {
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: text },
    ],
    max_tokens: maxTokens,
    temperature: 0.1,
  });
  let out: string = (res && (res.response ?? res.result?.response)) || '';
  out = String(out).trim();
  // 앞뒤 따옴표/괄호쌍 제거 (전체를 감싼 경우만)
  out = out.replace(/^\s*["'「『]([\s\S]*)["'」』]\s*$/,'$1').trim();
  // 모델이 "번역:" 같은 접두사를 붙이면 제거
  out = out.replace(/^(번역|translation|訳|翻訳|Translation|Here is the translation)\s*[:：]\s*/i, '').trim();
  return out;
}

/**
 * 단일 텍스트를 Workers AI 로 번역한다.
 *  1) 강력한 LLM 체인(70B → Gemma3 12B → 8B) 프롬프트 번역 — 상품명 등 복잡 텍스트에 강함
 *  2) 모두 깨지면 m2m100 폴백 (짧은 단어)
 *  3) 전부 실패/깨짐이면 원문 반환 (캐시 저장 안 함)
 * @returns { text: 번역문(또는 원문), ok: 캐시 저장해도 되는 정상 번역인지 }
 */
export async function aiTranslateOne(
  ai: any,
  text: string,
  source: string,
  target: string
): Promise<{ text: string; ok: boolean }> {
  const srcName = LANG_NAME[source] || 'Korean';
  const dstName = LANG_NAME[target] || 'English';
  const cjkTarget = target === 'ja' || target === 'zh';

  // 후보 중 "가장 한글이 적은(=가장 잘 번역된)" 결과를 추적.
  //   완벽(검증 통과)한 결과가 나오면 즉시 채택.
  //   완벽한 게 없더라도, 원문보다 확실히 번역된 최선 후보는 저장(ok=true)해 원문 노출을 막는다.
  let best: { text: string; hRatio: number } | null = null;
  const consider = (out: string) => {
    if (!out) return;
    const r = hangulRatio(out);
    if (!best || r < best.hRatio) best = { text: out, hRatio: r };
  };

  // 1) LLM 체인 (품질 높은 순서). 하나라도 검증 통과하면 즉시 채택.
  const LLM_CHAIN = [
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    '@cf/google/gemma-3-12b-it',
    '@cf/meta/llama-3.1-8b-instruct',
  ];
  for (const model of LLM_CHAIN) {
    try {
      const out = await llmTranslateOnce(ai, model, text, srcName, dstName, target);
      if (out && !isBrokenTranslation(text, out, target)) {
        return { text: out, ok: true };
      }
      // 검증엔 못 미쳐도(한글 15~) 대상언어 문자를 포함하면 후보로 보관
      if (out && (!cjkTarget || hasJapanese(out) || hasCJKIdeograph(out))) consider(out);
    } catch { /* 다음 모델로 */ }
  }

  // 2) m2m100 폴백 (짧은 단어에 강함)
  try {
    const res: any = await ai.run('@cf/meta/m2m100-1.2b', {
      text,
      source_lang: SERVER_LANG_MAP[source] || 'ko',
      target_lang: SERVER_LANG_MAP[target],
    });
    const out = String((res && (res.translated_text || res.result?.translated_text)) || '').trim();
    if (out && !isBrokenTranslation(text, out, target)) {
      return { text: out, ok: true };
    }
    if (out && !hasSillyRepetition(out) && (!cjkTarget || hasJapanese(out) || hasCJKIdeograph(out))) consider(out);
  } catch { /* 무시 */ }

  // 3) 완벽한 결과는 없지만, 원문(전부 한글)보다 확실히 번역된 최선 후보가 있으면 채택.
  //    최선 후보의 한글 비율이 원문 대비 절반 이하로 줄었을 때만(=실제 번역 진전) 저장.
  if (best !== null) {
    const b = best as { text: string; hRatio: number };
    const srcRatio = hangulRatio(text);
    if (b.hRatio < srcRatio * 0.5 && b.hRatio < 0.35) {
      return { text: b.text, ok: true };
    }
  }

  // 4) 전부 실패 → 원문 유지(캐시 저장 안 함)
  return { text, ok: false };
}

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
  const cLocale = cacheLocale(target); // 버전 접미사 포함 캐시 키

  // 1) 캐시 조회 (버전 캐시 사용 + 깨진 캐시는 무효화 후 재번역)
  if (db) {
    try {
      await ensureTranslationTable(db);
      const cached = await getCachedTranslations(db, uniqueTexts, cLocale);
      const staleKeys: string[] = [];
      for (const [k, v] of cached) {
        if (isBrokenTranslation(k, v, target)) staleKeys.push(k);
        else out.set(k, v);
      }
      if (staleKeys.length > 0) await deleteTranslations(db, staleKeys, cLocale);
    } catch { /* 무시 */ }
  }

  // 2) 미캐시만 AI 번역 (LLM 우선 → 검증 → m2m100 폴백; 정상 결과만 캐시)
  const toTranslate = uniqueTexts.filter((t) => !out.has(t));
  if (toTranslate.length > 0 && ai) {
    const newly: { sourceText: string; translatedText: string }[] = [];
    for (const text of toTranslate) {
      const { text: translated, ok } = await aiTranslateOne(ai, text, source, target);
      out.set(text, translated);
      // ok=true(검증 통과) 이고 원문과 다를 때만 캐시 저장 → 깨진 번역이 캐시에 남지 않도록
      if (ok && translated && translated !== text) {
        newly.push({ sourceText: text, translatedText: translated });
      }
    }
    if (db && newly.length > 0) {
      try { await saveTranslations(db, newly, cLocale); } catch { /* 무시 */ }
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

/** 잘못 캐시된 번역 삭제 (재번역 위해). 원문+대상언어로 제거. */
export async function deleteTranslations(
  db: any,
  sourceTexts: string[],
  targetLocale: string
): Promise<void> {
  if (!db || sourceTexts.length === 0) return;
  try {
    const placeholders = sourceTexts.map(() => '?').join(',');
    await db
      .prepare(
        `DELETE FROM "Translation"
         WHERE "targetLocale" = ? AND "sourceText" IN (${placeholders})`
      )
      .bind(targetLocale, ...sourceTexts)
      .run();
  } catch {
    // 삭제 실패는 무시(다음 요청에서 재시도)
  }
}
