import { NextRequest, NextResponse } from 'next/server';
import {
  ensureTranslationTable,
  getCachedTranslations,
  saveTranslations,
  deleteTranslations,
  aiTranslateOne,
  isBrokenTranslation,
  cacheLocale,
} from '@/lib/translateCache';

// m2m100 언어 코드 매핑 (앱 Locale → 모델 언어코드)
const LANG_MAP: Record<string, string> = {
  ko: 'ko',
  en: 'en',
  ja: 'ja',
  zh: 'zh',
  vi: 'vi',
  th: 'th',
};

async function getEnv(): Promise<any> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    return ctx.env as any;
  } catch {
    return null;
  }
}

/**
 * POST /api/translate
 * body: { texts: string[], target: Locale, source?: Locale }
 * → { success, translations: { [sourceText]: translatedText } }
 *
 * - 대상 언어가 'ko'(원문)면 번역 없이 그대로 반환
 * - D1 캐시 우선 조회, 미캐시 항목만 Workers AI 로 번역 후 캐시 저장
 * - AI/캐시 실패 시에도 원문을 그대로 반환하여 화면이 깨지지 않도록 함
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const texts: string[] = Array.isArray(body?.texts) ? body.texts : [];
    const target: string = String(body?.target || '');
    const source: string = String(body?.source || 'ko');

    // 중복 제거 + 공백 제거
    const uniqueTexts = Array.from(
      new Set(texts.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean))
    ).slice(0, 100); // 최대 100개

    const passthrough = () => {
      const map: Record<string, string> = {};
      for (const t of uniqueTexts) map[t] = t;
      return NextResponse.json({ success: true, translations: map });
    };

    // 원문 언어거나 지원하지 않는 언어면 그대로 반환
    if (!target || target === source || !LANG_MAP[target]) {
      return passthrough();
    }
    if (uniqueTexts.length === 0) {
      return NextResponse.json({ success: true, translations: {} });
    }

    const env = await getEnv();
    const db = env?.DB;
    const ai = env?.AI;

    const out: Record<string, string> = {};
    const cLocale = cacheLocale(target); // 버전 접미사 포함 캐시 키(과거 캐시 우회)

    // 1) 캐시 조회 (버전 캐시 사용 + 과거에 잘못 저장된 깨진 번역은 무효화 후 재번역)
    if (db) {
      await ensureTranslationTable(db);
      const cached = await getCachedTranslations(db, uniqueTexts, cLocale);
      const staleKeys: string[] = [];
      for (const [k, v] of cached) {
        if (isBrokenTranslation(k, v, target)) {
          staleKeys.push(k); // 깨진 캐시 → 미캐시로 취급하여 재번역
        } else {
          out[k] = v;
        }
      }
      // 깨진 캐시 삭제(재번역 결과로 새로 저장되도록)
      if (staleKeys.length > 0) {
        await deleteTranslations(db, staleKeys, cLocale);
      }
    }

    // 2) 미캐시 항목만 AI 번역
    const toTranslate = uniqueTexts.filter((t) => !(t in out));

    if (toTranslate.length > 0 && ai) {
      const newlyTranslated: { sourceText: string; translatedText: string }[] = [];
      for (const text of toTranslate) {
        // LLM(llama-3.1) 우선 → 검증 → m2m100 폴백. 깨진 번역은 원문 유지(캐시 저장 안 함).
        const { text: translated, ok } = await aiTranslateOne(ai, text, source, target);
        out[text] = translated;
        if (ok && translated && translated !== text) {
          newlyTranslated.push({ sourceText: text, translatedText: translated });
        }
      }
      // 3) 검증 통과한 번역만 캐시 저장
      if (db && newlyTranslated.length > 0) {
        await saveTranslations(db, newlyTranslated, cLocale);
      }
    } else {
      // AI 미가용 → 미캐시 항목 원문 유지
      for (const t of toTranslate) out[t] = t;
    }

    return NextResponse.json({ success: true, translations: out });
  } catch (e: any) {
    // 어떤 에러든 화면이 깨지지 않도록 빈 결과 반환
    return NextResponse.json(
      { success: false, translations: {}, error: String(e?.message || e || '') },
      { status: 200 }
    );
  }
}
