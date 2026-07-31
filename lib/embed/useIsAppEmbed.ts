'use client';

// ============================================================================
// 큐알쳇 앱 WebView 진입 감지 훅 + 서버단 kill-switch
// ============================================================================
// 목적
//   큐알쳇 앱의 인앱 WebView(qrlive_mall_webview_screen.dart)로 접속했을 때,
//   웹 자체의 헤더/푸터/모바일 하단탭을 자동으로 숨겨서 앱 UI(Flutter 앱바)와
//   중복되지 않게 한다. 카톡 스타일로 깔끔하게.
//
// 서버단 재제어
//   앱 재설치 없이 이 파일 하나만 수정/배포하면 모든 임베드 UX 를 즉시 바꿀 수 있다.
//   - 헤더를 다시 켜고 싶다: FORCE_SHOW_ALL = true 로 바꾸고 배포.
//   - 특정 페이지에서만 켜고 싶다: shouldShowInEmbed(pathname) 함수 수정.
//   - 감지 조건을 강화/완화하고 싶다: useIsAppEmbed 내부 로직 수정.
//
// 감지 우선순위
//   1) URL 쿼리 ?embed=app | ?embed=web   (앱에서 진입 시 명시)
//   2) localStorage 'qrchat_embed'         (SSO 리다이렉트로 쿼리 유실되어도 유지)
//   3) User-Agent 힌트 (io.qrchat.app / QRChatWebView) (최후 폴백)
// ============================================================================

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * 서버단 kill-switch:
 *   true 로 바꿔서 배포하면 앱 안에서도 모든 웹 헤더/푸터가 다시 보인다.
 *   개발자 확인용 / 롤백용.
 */
export const FORCE_SHOW_ALL_IN_APP = false;

const STORAGE_KEY = 'qrchat_embed';

export function useIsAppEmbed(): boolean {
  const searchParams = useSearchParams();
  const [embed, setEmbed] = useState<boolean>(false);

  useEffect(() => {
    if (FORCE_SHOW_ALL_IN_APP) {
      setEmbed(false);
      return;
    }
    try {
      // 1) URL 쿼리 (앱 진입 시 명시)
      const q = searchParams?.get('embed');
      if (q === 'app') {
        try {
          window.localStorage.setItem(STORAGE_KEY, 'app');
        } catch {
          /* 프라이빗 모드 등 저장 실패는 무시 */
        }
        setEmbed(true);
        return;
      }
      if (q === 'web') {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* noop */
        }
        setEmbed(false);
        return;
      }

      // 2) localStorage 유지 (SSO 리다이렉트 후에도 유지)
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(STORAGE_KEY);
      } catch {
        stored = null;
      }
      if (stored === 'app') {
        setEmbed(true);
        return;
      }

      // 3) UA 힌트 폴백 (큐알쳇 WebView 는 io.qrchat.app / QRChatWebView 를 포함)
      const ua =
        typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      if (/io\.qrchat\.app|QRChatWebView/i.test(ua)) {
        try {
          window.localStorage.setItem(STORAGE_KEY, 'app');
        } catch {
          /* noop */
        }
        setEmbed(true);
        return;
      }

      setEmbed(false);
    } catch {
      setEmbed(false);
    }
  }, [searchParams]);

  return embed;
}

/**
 * 특정 경로에서 예외적으로 임베드 상태에서도 웹 헤더/푸터를 보여야 한다면
 * 여기에 화이트리스트를 추가한다. 서버 배포로 즉시 적용.
 *
 * 예) if (pathname.startsWith('/legal')) return true;
 */
export function shouldShowInEmbed(_pathname: string): boolean {
  return false;
}
