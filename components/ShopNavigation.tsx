'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useEffect, useState } from 'react';

export default function ShopNavigation() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchCartCount();
    }
  }, [user]);

  const fetchCartCount = async () => {
    try {
      const res = await fetch('/api/cart', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCartCount(data.data?.length || 0);
      }
    } catch (error) {
      console.error('장바구니 개수 조회 실패:', error);
    }
  };

  const navLinks = [
    { href: '/products', label: '🛍️ 상품 목록', icon: '🛍️' },
    { href: '/cart', label: '🛒 장바구니', icon: '🛒', badge: cartCount },
    { href: '/orders', label: '📦 주문내역', icon: '📦' },
  ];

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 로고 & 홈 */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-gray-900 hover:text-blue-600 transition">
            <span className="text-2xl">🏪</span>
            <span className="hidden sm:inline">Live Commerce</span>
          </Link>

          {/* 네비게이션 링크 */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 sm:px-4 py-2 rounded-lg font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={isActive ? '' : 'text-lg'}>{link.icon}</span>
                    <span className="hidden sm:inline">{link.label.split(' ')[1]}</span>
                  </span>
                  {link.badge !== undefined && link.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {link.badge > 99 ? '99+' : link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* 사용자 정보 */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="hidden md:inline text-sm text-gray-700">
                  <span className="font-semibold">{user.name}</span>님
                </span>
                <Link
                  href="/"
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                >
                  홈으로
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                로그인
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
