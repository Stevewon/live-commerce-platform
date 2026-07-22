'use client';

import React, { useEffect, useState, useRef } from 'react';
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
  // 번역 버전: 캐시가 갱신될 때마다 증가시켜 확실히 리렌더를 유발한다.
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(locale === 'ko');
  // 진행 중인 요청 키들(중복 요청만 방지, 새 항목 요청은 절대 막지 않음)
  const inFlight = useRef<Set<string>>(new Set());

  // texts 를 정규화한 안정적인 키 (렌더마다 새 배열이어도 내용 같으면 동일)
  const uniqueTexts = Array.from(
    new Set((texts || []).map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean))
  );
  const textsKey = uniqueTexts.slice().sort().join('\u0001');

  useEffect(() => {
    if (locale === 'ko') {
      setReady(true);
      return;
    }
    if (uniqueTexts.length === 0) {
      setReady(true);
      return;
    }

    const cache = (memoryCache[locale] = memoryCache[locale] || {});
    // 아직 캐시에 없고, 현재 진행 중이지도 않은 항목만 요청
    const missing = uniqueTexts.filter((t) => !(t in cache) && !inFlight.current.has(`${locale}::${t}`));

    if (missing.length === 0) {
      // 이미 전부 캐시에 있으면 준비 완료
      const allCached = uniqueTexts.every((t) => t in cache);
      if (allCached) setReady(true);
      return;
    }

    for (const t of missing) inFlight.current.add(`${locale}::${t}`);
    setReady(false);

    let cancelled = false;
    (async () => {
      try {
        // 100개씩 나눠 요청 (API 한도)
        for (let i = 0; i < missing.length; i += 100) {
          const chunk = missing.slice(i, i + 100);
          const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: chunk, target: locale, source: 'ko' }),
          });
          const data = await res.json().catch(() => ({}));
          const translations: Record<string, string> = data?.translations || {};
          for (const t of chunk) {
            cache[t] = translations[t] || t;
          }
          if (!cancelled) setVersion((n) => n + 1); // 청크마다 즉시 반영
        }
      } catch {
        for (const t of missing) if (!(t in cache)) cache[t] = t;
      } finally {
        for (const t of missing) inFlight.current.delete(`${locale}::${t}`);
        if (!cancelled) {
          setReady(true);
          setVersion((n) => n + 1);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // textsKey 가 바뀌면(상품이 async 로 추가로 로드되는 경우 포함) 다시 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, textsKey]);

  // version 을 의존해 캐시 갱신 시 tr 이 새 값을 읽도록 보장
  const tr = React.useCallback(
    (text: string | null | undefined): string => {
      if (!text) return '';
      if (locale === 'ko') return text;
      const cache = memoryCache[locale];
      return (cache && cache[text.trim()]) || text;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, version]
  );

  return { tr, ready };
}
