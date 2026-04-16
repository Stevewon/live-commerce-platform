'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useState } from 'react';
import LanguageSelector from '@/components/LanguageSelector';

export default function ShopNavigation() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return pathname === path ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100';
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/products" className="flex items-center space-x-2">
              <span className="text-xl sm:text-2xl font-bold text-blue-600">🛍️</span>
              <span className="text-base sm:text-xl font-bold text-gray-900">{t.nav.liveCommerce}</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            <Link
              href="/products"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/products')}`}
            >
              {t.nav.home}
            </Link>
            <Link
              href="/products"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/products')}`}
            >
              {t.nav.products}
            </Link>
            <Link
              href="/live"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/live')}`}
            >
              {t.nav.liveBroadcast}
            </Link>
            {user && (
              <>
                <Link
                  href="/cart"
                  prefetch={false}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/cart')}`}
                >
                  🛒 {t.nav.cart}
                </Link>
                <Link
                  href="/my-orders"
                  prefetch={false}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/my-orders')}`}
                >
                  {t.nav.orderHistory}
                </Link>
              </>
            )}
            {!user && (
              <Link
                href="/cart"
                prefetch={false}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/cart')}`}
              >
                🛒 {t.nav.cart}
              </Link>
            )}
          </div>

          {/* User Menu + Language Selector */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <LanguageSelector variant="compact" />
            
            {user ? (
              <>
                <span className="hidden sm:inline text-sm text-gray-700">
                  <span className="font-semibold">{user.name}</span>{t.nav.greeting}
                </span>
                {user.role === 'ADMIN' && (
                  <Link
                    href="/admin"
                    className="hidden sm:inline-block px-3 py-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 border border-purple-600 rounded-md hover:bg-purple-50 transition-colors"
                  >
                    {t.nav.admin}
                  </Link>
                )}
                {user.role === 'PARTNER' && (
                  <Link
                    href="/partner"
                    className="hidden sm:inline-block px-3 py-1.5 text-sm font-medium text-green-600 hover:text-green-700 border border-green-600 rounded-md hover:bg-green-50 transition-colors"
                  >
                    {t.nav.partner}
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  {t.nav.logout}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  {t.nav.login}
                </Link>
                <Link
                  href="/register"
                  className="px-3 py-1.5 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                >
                  {t.nav.register}
                </Link>
              </>
            )}

            {/* Mobile Menu Button */}
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

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-3 pt-2 pb-3 space-y-1">
            <Link
              href="/products"
              onClick={() => setMenuOpen(false)}
              className={`block px-3 py-2.5 rounded-md text-sm font-medium ${isActive('/products')}`}
            >
              {t.nav.home}
            </Link>
            <Link
              href="/products"
              onClick={() => setMenuOpen(false)}
              className={`block px-3 py-2.5 rounded-md text-sm font-medium ${isActive('/products')}`}
            >
              {t.nav.products}
            </Link>
            <Link
              href="/live"
              onClick={() => setMenuOpen(false)}
              className={`block px-3 py-2.5 rounded-md text-sm font-medium ${isActive('/live')}`}
            >
              {t.nav.liveBroadcast}
            </Link>
            {user && (
              <>
                <Link
                  href="/cart"
                  prefetch={false}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-md text-sm font-medium ${isActive('/cart')}`}
                >
                  🛒 {t.nav.cart}
                </Link>
                <Link
                  href="/my-orders"
                  prefetch={false}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-md text-sm font-medium ${isActive('/my-orders')}`}
                >
                  {t.nav.orderHistory}
                </Link>
                {user.role === 'ADMIN' && (
                  <Link href="/admin" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-md text-sm font-medium text-purple-600 hover:bg-purple-50">
                    {t.nav.adminDashboard}
                  </Link>
                )}
                {user.role === 'PARTNER' && (
                  <Link href="/partner" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-md text-sm font-medium text-green-600 hover:bg-green-50">
                    {t.nav.partnerDashboard}
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
                🛒 {t.nav.cart}
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
