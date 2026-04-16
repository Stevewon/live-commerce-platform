'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useState } from 'react';

export default function ShopNavigation() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return pathname === path ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100';
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/';
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* 로고 */}
          <div className="flex items-center">
            <Link href="/products" className="flex items-center space-x-2">
              <span className="text-xl sm:text-2xl font-bold text-blue-600">🛍️</span>
              <span className="text-base sm:text-xl font-bold text-gray-900">라이브커머스</span>
            </Link>
          </div>

          {/* 네비게이션 메뉴 - 데스크톱 */}
          <div className="hidden md:flex items-center space-x-1">
            <Link
              href="/products"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/products')}`}
            >
              홈
            </Link>
            <Link
              href="/products"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/products')}`}
            >
              상품 목록
            </Link>
            <Link
              href="/live"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/live')}`}
            >
              라이브 방송
            </Link>
            {user && (
              <>
                <Link
                  href="/cart"
                  prefetch={false}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/cart')}`}
                >
                  🛒 장바구니
                </Link>
                <Link
                  href="/my-orders"
                  prefetch={false}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/my-orders')}`}
                >
                  주문내역
                </Link>
              </>
            )}
            {!user && (
              <Link
                href="/cart"
                prefetch={false}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/cart')}`}
              >
                🛒 장바구니
              </Link>
            )}
          </div>

          {/* 사용자 메뉴 */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {user ? (
              <>
                <span className="hidden sm:inline text-sm text-gray-700">
                  <span className="font-semibold">{user.name}</span>님
                </span>
                {user.role === 'ADMIN' && (
                  <Link
                    href="/admin"
                    className="hidden sm:inline-block px-3 py-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 border border-purple-600 rounded-md hover:bg-purple-50 transition-colors"
                  >
                    관리자
                  </Link>
                )}
                {user.role === 'PARTNER' && (
                  <Link
                    href="/partner"
                    className="hidden sm:inline-block px-3 py-1.5 text-sm font-medium text-green-600 hover:text-green-700 border border-green-600 rounded-md hover:bg-green-50 transition-colors"
                  >
                    파트너
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  로그인
                </Link>
                <Link
                  href="/register"
                  className="px-3 py-1.5 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                >
                  회원가입
                </Link>
              </>
            )}

            {/* 모바일 메뉴 버튼 */}
            <button
              type="button"
              className="md:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 모바일 메뉴 - React state로 제어 */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-3 pt-2 pb-3 space-y-1">
            <Link
              href="/products"
              onClick={() => setMenuOpen(false)}
              className={`block px-3 py-2.5 rounded-md text-sm font-medium ${isActive('/products')}`}
            >
              홈
            </Link>
            <Link
              href="/products"
              onClick={() => setMenuOpen(false)}
              className={`block px-3 py-2.5 rounded-md text-sm font-medium ${isActive('/products')}`}
            >
              상품 목록
            </Link>
            <Link
              href="/live"
              onClick={() => setMenuOpen(false)}
              className={`block px-3 py-2.5 rounded-md text-sm font-medium ${isActive('/live')}`}
            >
              라이브 방송
            </Link>
            {user && (
              <>
                <Link
                  href="/cart"
                  prefetch={false}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-md text-sm font-medium ${isActive('/cart')}`}
                >
                  🛒 장바구니
                </Link>
                <Link
                  href="/my-orders"
                  prefetch={false}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-md text-sm font-medium ${isActive('/my-orders')}`}
                >
                  주문내역
                </Link>
                {user.role === 'ADMIN' && (
                  <Link href="/admin" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-md text-sm font-medium text-purple-600 hover:bg-purple-50">
                    관리자 대시보드
                  </Link>
                )}
                {user.role === 'PARTNER' && (
                  <Link href="/partner" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-md text-sm font-medium text-green-600 hover:bg-green-50">
                    파트너 대시보드
                  </Link>
                )}
              </>
            )}
            {!user && (
              <Link
                href="/cart"
                prefetch={false}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-md text-sm font-medium ${isActive('/cart')}`}
              >
                🛒 장바구니
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
