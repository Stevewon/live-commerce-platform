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
  // 현재 locale 의 번역 맵을 컴포넌트 state 로 보관한다.
  // 모듈 전역 memoryCache 만 갱신하면 리렌더가 확실히 일어나지 않으므로,
  // state 로 복제해 캐시가 채워질 때마다 새 참조를 만들어 리렌더를 보장한다.
  const [map, setMap] = useState<Record<string, string>>(
    () => ({ ...(memoryCache[locale] || {}) })
  );
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
    // locale 이 바뀌면 해당 locale 의 기존 캐시를 즉시 반영
    setMap({ ...(memoryCache[locale] || {}) });

    if (uniqueTexts.length === 0) {
      setReady(true);
      return;
    }

    const cache = (memoryCache[locale] = memoryCache[locale] || {});
    // 아직 캐시에 없고, 현재 진행 중이지도 않은 항목만 요청
    const missing = uniqueTexts.filter((t) => !(t in cache) && !inFlight.current.has(`${locale}::${t}`));

    if (missing.length === 0) {
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
          // 청크마다 state 를 새 객체로 갱신 → 확실한 리렌더
          if (!cancelled) setMap({ ...cache });
        }
      } catch {
        for (const t of missing) if (!(t in cache)) cache[t] = t;
        if (!cancelled) setMap({ ...cache });
      } finally {
        for (const t of missing) inFlight.current.delete(`${locale}::${t}`);
        if (!cancelled) {
          setMap({ ...cache });
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // textsKey 가 바뀌면(상품이 async 로 추가로 로드되는 경우 포함) 다시 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, textsKey]);

  // map(state) 을 읽어 번역 반환 → map 이 갱신될 때마다 새 tr 참조 생성 → 리렌더 반영 보장
  const tr = React.useCallback(
    (text: string | null | undefined): string => {
      if (!text) return '';
      if (locale === 'ko') return text;
      return map[text.trim()] || text;
    },
    [locale, map]
  );

  return { tr, ready };
}
