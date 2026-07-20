import { NextRequest, NextResponse } from 'next/server';
import {
  ensureTranslationTable,
  getCachedTranslations,
  saveTranslations,
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

    // 1) 캐시 조회
    if (db) {
      await ensureTranslationTable(db);
      const cached = await getCachedTranslations(db, uniqueTexts, target);
      for (const [k, v] of cached) out[k] = v;
    }

    // 2) 미캐시 항목만 AI 번역
    const toTranslate = uniqueTexts.filter((t) => !(t in out));

    if (toTranslate.length > 0 && ai) {
      const newlyTranslated: { sourceText: string; translatedText: string }[] = [];
      for (const text of toTranslate) {
        try {
          const res: any = await ai.run('@cf/meta/m2m100-1.2b', {
            text,
            source_lang: LANG_MAP[source] || 'ko',
            target_lang: LANG_MAP[target],
          });
          const translated =
            (res && (res.translated_text || res.result?.translated_text)) || text;
          out[text] = translated;
          if (translated && translated !== text) {
            newlyTranslated.push({ sourceText: text, translatedText: translated });
          }
        } catch {
          // 개별 번역 실패 → 원문 유지
          out[text] = text;
        }
      }
      // 3) 캐시 저장
      if (db && newlyTranslated.length > 0) {
        await saveTranslations(db, newlyTranslated, target);
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
