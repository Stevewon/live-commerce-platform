'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useIsAppEmbed } from '@/lib/embed/useIsAppEmbed';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useLanguage();
  // ★★★ 모든 훅 호출을 조건부 return 이전에 배치 — React Hook 규칙 준수.
  const isAppEmbed = useIsAppEmbed();

  // Hide on admin/partner dashboards
  if (pathname.startsWith('/admin') || pathname.startsWith('/partner')) {
    return null;
  }

  // ★★★ 2026-08-15 수정 (바로구매 버튼 클릭 불가 사건):
  //   상품 상세페이지(/products/[slug])와 체크아웃/장바구니에는 화면 최하단에
  //   자체 고정 액션 바(장바구니/바로구매/결제 버튼: fixed bottom-0 z-50)가 있다.
  //   이 하단 탭 네비도 fixed bottom-0 z-50 이라 같은 위치에서 겹쳐,
  //   탭 네비(특히 '찜' 링크)가 구매 버튼 위를 덮어 클릭을 통째로 가로챘다.
  //   → 실제 증상: "기절베개 검색 후 바로구매를 눌러도 아무 반응 없음".
  //   해결: 하단 액션 바가 있는 상품 상세페이지에서만 이 탭 네비를 숨겨 겹침을 제거한다.
  //   (/products 목록·/cart·/checkout 에는 하단 고정 액션바가 없으므로 탭 네비 유지 —
  //    정확히 상세페이지 /products/[slug] 만 제외)
  const isProductDetail =
    pathname.startsWith('/products/') && pathname !== '/products';
  if (isProductDetail) {
    return null;
  }

  // ★★★ 큐알쳇 앱 WebView 안에서도 하단 탭은 유지한다.
  //   (헤더/푸터는 앱바와 중복되어 숨기지만, 하단 탭은 앱 화면 최하단에 위치해
  //    Flutter 앱바와 겹치지 않으며, 마이페이지·주문내역 등 핵심 진입 동선이라
  //    반드시 노출해야 한다. 예전엔 이걸 통째로 숨겨서 앱에서 마이페이지 진입이 불가했음.)
  //   서버단 kill-switch: lib/embed/useIsAppEmbed.ts 로 언제든 on/off.
  //   앱에서 하단탭까지 숨기고 싶으면 아래 주석을 해제하면 됨.
  // if (isAppEmbed && !shouldShowInEmbed(pathname)) {
  //   return null;
  // }
  void isAppEmbed; // (감지값 유지: 향후 임베드별 스타일 분기 대비)

  const navItems = [
    { href: '/products', icon: '🏠', label: t.nav.home, activeCheck: (p: string) => p === '/products' || p === '/' },
    { href: '/lives', icon: '📺', label: t.nav.liveBroadcast, activeCheck: (p: string) => p.startsWith('/lives') },
    { href: '/cart', icon: '🛒', label: t.nav.cart, activeCheck: (p: string) => p === '/cart' },
    { href: '/wishlist', icon: '💖', label: t.nav.wishlist, activeCheck: (p: string) => p === '/wishlist' },
    { href: '/my', icon: '👤', label: user ? t.nav.myPage : t.nav.login, activeCheck: (p: string) => p.startsWith('/my') || p === '/login' || p === '/register', dynamicHref: !user ? '/login' : '/my' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.08)] safe-area-bottom">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const href = item.dynamicHref || item.href;
          const isActive = item.activeCheck(pathname + (typeof window !== 'undefined' ? window.location.search : ''));
          
          return (
            <Link
              key={item.href}
              href={href}
              prefetch={false}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                isActive 
                  ? 'text-blue-600' 
                  : 'text-gray-500 active:text-blue-600'
              }`}
            >
              <span className="text-xl leading-none mb-0.5">{item.icon}</span>
              <span className={`text-[10px] font-medium leading-none ${isActive ? 'font-bold' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
