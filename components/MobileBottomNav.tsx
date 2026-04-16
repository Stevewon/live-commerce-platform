'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  // 관리자/파트너 대시보드에서는 숨김
  if (pathname.startsWith('/admin') || pathname.startsWith('/partner')) {
    return null;
  }

  const navItems = [
    { href: '/products', icon: '🏠', label: '홈', activeCheck: (p: string) => p === '/products' || p === '/' },
    { href: '/lives', icon: '📺', label: '라이브', activeCheck: (p: string) => p.startsWith('/lives') },
    { href: '/cart', icon: '🛒', label: '장바구니', activeCheck: (p: string) => p === '/cart' },
    { href: '/wishlist', icon: '💖', label: '찜', activeCheck: (p: string) => p === '/wishlist' },
    { href: '/my', icon: '👤', label: user ? '마이' : '로그인', activeCheck: (p: string) => p.startsWith('/my') || p === '/login' || p === '/register', dynamicHref: !user ? '/login' : '/my' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.08)] safe-area-bottom">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const href = item.dynamicHref || item.href;
          const isActive = item.activeCheck(pathname + (typeof window !== 'undefined' ? window.location.search : ''));
          
          return (
            <Link
              key={item.label}
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
