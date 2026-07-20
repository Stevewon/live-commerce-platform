'use client';

import { useEffect, useState, useRef } from 'react';
import { useLanguage } from './LanguageContext';

// 세션(브라우저) 단위 메모리 캐시: locale → (sourceText → translated)
const memoryCache: Record<string, Record<string, string>> = {};

/**
 * 동적 텍스트(상품명/카테고리명 등)를 현재 선택된 언어로 자동 번역한다.
 *
 * @param texts 원문(한국어) 문자열 배열
 * @returns { tr, ready }
 *   - tr(text): 번역된 문자열(없으면 원문) 반환
 *   - ready: 번역 로드 완료 여부
 *
 * - locale 이 'ko' 면 번역 없이 원문 그대로 반환 (API 호출 안 함)
 * - 결과는 브라우저 메모리에 캐시되어 재요청 시 즉시 반환
 * - 실패 시 원문을 그대로 사용 (화면 안 깨짐)
 */
export function useAutoTranslate(texts: string[]): {
  tr: (text: string | null | undefined) => string;
  ready: boolean;
} {
  const { locale } = useLanguage();
  const [, forceRender] = useState(0);
  const [ready, setReady] = useState(locale === 'ko');
  const inFlight = useRef<string>('');

  useEffect(() => {
    if (locale === 'ko') {
      setReady(true);
      return;
    }

    const unique = Array.from(
      new Set((texts || []).map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean))
    );
    if (unique.length === 0) {
      setReady(true);
      return;
    }

    const cache = (memoryCache[locale] = memoryCache[locale] || {});
    const missing = unique.filter((t) => !(t in cache));

    if (missing.length === 0) {
      setReady(true);
      return;
    }

    // 동일 요청 중복 방지 키
    const key = `${locale}::${missing.slice().sort().join('|')}`;
    if (inFlight.current === key) return;
    inFlight.current = key;
    setReady(false);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: missing, target: locale, source: 'ko' }),
        });
        const data = await res.json().catch(() => ({}));
        const translations: Record<string, string> = data?.translations || {};
        for (const t of missing) {
          cache[t] = translations[t] || t;
        }
      } catch {
        // 실패 시 원문 유지
        for (const t of missing) cache[t] = t;
      } finally {
        if (!cancelled) {
          setReady(true);
          forceRender((n) => n + 1);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, JSON.stringify(texts)]);

  const tr = (text: string | null | undefined): string => {
    if (!text) return '';
    if (locale === 'ko') return text;
    const cache = memoryCache[locale];
    return (cache && cache[text.trim()]) || text;
  };

  return { tr, ready };
}
