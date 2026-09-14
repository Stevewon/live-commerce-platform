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
//   - 왼쪽 ‹ (뒤로가기): history.back (그대로 유지)
//   - 오른쪽 X (닫기): 웹뷰를 닫고 "앱 메인" 으로 나가라는 신호를 앱에 전달.
//                      (뒤로가기가 아니라, 쇼핑몰을 완전히 벗어나 앱 홈으로!)
//
// 앱(Flutter) 연동 안내 — X(닫기)는 "앱 메인으로 이동" 이어야 함.
//   앱 쪽에서 아래 핸들러 중 하나를 받아서 Navigator 로 앱 메인 화면으로 보내면 됨:
//   1) flutter_inappwebview:  window.flutter_inappwebview.callHandler('closeWebview', 'main')
//   2) JavascriptChannel:     QRChatChannel.postMessage('goMain')   // 'close' 도 하위호환 처리 권장
//   3) Android interface:     window.QRChatApp.goMain()  또는 closeWebview()
//   4) iOS WKScriptMessage:    window.webkit.messageHandlers.qrchatClose.postMessage('goMain')
//   ※ 앱이 이 신호를 받으면 반드시 '앱 메인 화면' 으로 보내야 한다(뒤로가기 X).
//   ※ 웹만으로는 앱 화면을 못 바꾸므로, 신호 전달 후에도 웹은 홈('/')으로 폴백 이동.
// ============================================================================

import { usePathname } from 'next/navigation';
import { useIsAppEmbed } from '@/lib/embed/useIsAppEmbed';

export default function AppEmbedCloseBar() {
  const isAppEmbed = useIsAppEmbed();
  const pathname = usePathname();

  // 앱 WebView 가 아니면 렌더하지 않음 (일반 웹/PC 는 기존 헤더 사용)
  if (!isAppEmbed) return null;

  // X(닫기) = "앱 메인으로 나가기"
  //   웹은 앱 화면을 직접 못 바꾸므로, 알려진 모든 앱 브릿지에 "메인으로" 신호를
  //   (하위호환 'close' 포함) 전부 쏜 뒤, 웹 자체는 홈('/')으로 폴백 이동한다.
  //   → 앱이 신호를 받으면 앱 메인으로 이동, 아직 미구현이라도 최소한 쇼핑몰 홈으로.
  const handleClose = () => {
    let signaled = false;
    try {
      const w = window as any;

      // 1) flutter_inappwebview callHandler ('main' 인자로 의도 전달)
      if (w.flutter_inappwebview?.callHandler) {
        try { w.flutter_inappwebview.callHandler('closeWebview', 'main'); signaled = true; } catch {}
        try { w.flutter_inappwebview.callHandler('goMain'); signaled = true; } catch {}
      }
      // 2) Flutter WebView JavascriptChannel (QRChatChannel)
      if (w.QRChatChannel?.postMessage) {
        try { w.QRChatChannel.postMessage('goMain'); signaled = true; } catch {}
        try { w.QRChatChannel.postMessage('close'); signaled = true; } catch {} // 하위호환
      }
      // 3) Android addJavascriptInterface (QRChatApp)
      if (w.QRChatApp) {
        try { if (w.QRChatApp.goMain) { w.QRChatApp.goMain(); signaled = true; } } catch {}
        try { if (w.QRChatApp.closeWebview) { w.QRChatApp.closeWebview(); signaled = true; } } catch {}
      }
      // 4) iOS WKScriptMessageHandler
      if (w.webkit?.messageHandlers?.qrchatClose?.postMessage) {
        try { w.webkit.messageHandlers.qrchatClose.postMessage('goMain'); signaled = true; } catch {}
      }
    } catch {
      /* noop */
    }

    // 웹 폴백: 앱 신호와 무관하게 쇼핑몰 최상단(홈)으로 이동.
    //   (앱이 신호를 받아 앱 메인으로 나가면 이 화면은 어차피 사라진다.
    //    앱이 아직 미구현이면 최소한 쇼핑몰 첫 화면으로 돌아간다 — 뒤로가기 아님.)
    try {
      window.location.href = '/';
    } catch {
      /* noop */
    }
    void signaled;
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
