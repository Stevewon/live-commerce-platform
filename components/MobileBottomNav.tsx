'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useIsAppEmbed, shouldShowInEmbed } from '@/lib/embed/useIsAppEmbed';

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

  // ★★★ 큐알쳇 앱 WebView 안에서는 하단 탭 숨김 (카톡 스타일).
  //   서버단 kill-switch: lib/embed/useIsAppEmbed.ts 로 언제든 on/off.
  if (isAppEmbed && !shouldShowInEmbed(pathname)) {
    return null;
  }

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
