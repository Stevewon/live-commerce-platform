'use client';

// ============================================================================
// 큐알쳇 앱 WebView 전용 상단 닫기(X) 바 — 톡딜 스타일
// ============================================================================
// 목적
//   앱 WebView 안에서는 웹 헤더(ShopNavigation)가 숨겨지는데, Flutter 앱바에
//   닫기 버튼이 없으면 사용자가 쇼핑몰에서 빠져나갈 방법이 없다.
//   → 톡딜처럼 웹이 직접 상단 우측에 X(닫기) 버튼을 그려주고,
//     누르면 앱(Flutter/Android/iOS)에 "닫기" 신호를 보내거나 뒤로가기로 폴백.
//
// 동작
//   - 앱 임베드(useIsAppEmbed=true)에서만 렌더. 일반 웹/PC 에서는 아무것도 안 그림.
//   - X 클릭 시: 알려진 앱 브릿지들을 순서대로 시도 → 없으면 history.back().
//
// 앱(Flutter) 연동 안내 (앱 쪽에서 아래 중 하나만 열어주면 즉시 동작):
//   1) flutter_inappwebview JS handler:  window.flutter_inappwebview.callHandler('closeWebview')
//   2) Flutter WebView JavascriptChannel: QRChatChannel.postMessage('close')
//   3) Android addJavascriptInterface:    window.QRChatApp.closeWebview()
//   4) iOS WKScriptMessageHandler:         window.webkit.messageHandlers.qrchatClose.postMessage('close')
//   앱이 아직 아무것도 안 열어줘도, 폴백으로 history.back() 이 실행되어 최소한 뒤로는 간다.
// ============================================================================

import { usePathname } from 'next/navigation';
import { useIsAppEmbed } from '@/lib/embed/useIsAppEmbed';

export default function AppEmbedCloseBar() {
  const isAppEmbed = useIsAppEmbed();
  const pathname = usePathname();

  // 앱 WebView 가 아니면 렌더하지 않음 (일반 웹/PC 는 기존 헤더 사용)
  if (!isAppEmbed) return null;

  const handleClose = () => {
    try {
      const w = window as any;

      // 1) flutter_inappwebview callHandler
      if (w.flutter_inappwebview?.callHandler) {
        w.flutter_inappwebview.callHandler('closeWebview');
        return;
      }
      // 2) Flutter WebView JavascriptChannel (QRChatChannel)
      if (w.QRChatChannel?.postMessage) {
        w.QRChatChannel.postMessage('close');
        return;
      }
      // 3) Android addJavascriptInterface (QRChatApp)
      if (w.QRChatApp?.closeWebview) {
        w.QRChatApp.closeWebview();
        return;
      }
      // 4) iOS WKScriptMessageHandler
      if (w.webkit?.messageHandlers?.qrchatClose?.postMessage) {
        w.webkit.messageHandlers.qrchatClose.postMessage('close');
        return;
      }

      // 5) 폴백: 뒤로 갈 데가 있으면 뒤로가기, 없으면 홈으로
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    } catch {
      try {
        window.history.back();
      } catch {
        /* noop */
      }
    }
  };

  const handleBack = () => {
    try {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    } catch {
      /* noop */
    }
  };

  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-between bg-white border-b border-gray-100 px-3"
      style={{
        // iOS 노치/상태바 안전영역만큼 위 여백
        paddingTop: 'env(safe-area-inset-top, 0px)',
        height: 'calc(3rem + env(safe-area-inset-top, 0px))',
      }}
    >
      {/* 왼쪽: 뒤로가기 (첫 화면이 아닐 때만 노출) */}
      {pathname !== '/' ? (
        <button
          type="button"
          onClick={handleBack}
          aria-label="뒤로"
          className="w-9 h-9 -ml-1 flex items-center justify-center rounded-full text-gray-700 active:bg-gray-100"
        >
          {/* chevron-left */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      ) : (
        <span className="w-9 h-9" />
      )}

      {/* 가운데: 브랜드 (선택) */}
      <span className="text-sm font-bold text-gray-900 select-none">큐라이브</span>

      {/* 오른쪽: 닫기(X) — 톡딜 스타일 */}
      <button
        type="button"
        onClick={handleClose}
        aria-label="닫기"
        className="w-9 h-9 -mr-1 flex items-center justify-center rounded-full text-gray-800 active:bg-gray-100"
      >
        {/* X */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
