'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';

export default function Footer() {
  const pathname = usePathname();
  const { t } = useLanguage();

  // Hide on admin/partner dashboards
  if (pathname.startsWith('/admin') || pathname.startsWith('/partner')) {
    return null;
  }

  return (
    <footer className="bg-gray-900 text-gray-300 pb-20 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top area */}
        <div className="py-8 sm:py-12 border-b border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div>
              <h2 className="text-xl font-bold text-white mb-3">
                🛍️ {t.footer.brandName}
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">
                {t.footer.brandDesc}
              </p>
            </div>

            {/* Customer Center */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                {t.footer.customerCenter}
              </h3>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-gray-400">{t.footer.phone} : </span>
                  <a href="tel:02-1551-4220" className="text-gray-300 hover:text-white transition">
                    02-1551-4220
                  </a>
                </p>
                <p className="text-gray-400">
                  {t.footer.businessHours}
                </p>
                <p className="text-gray-400">
                  {t.footer.holidays}
                </p>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                {t.footer.quickLinks}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Link href="/products" className="text-gray-400 hover:text-white transition">
                  {t.nav.shopping}
                </Link>
                <Link href="/orders/lookup" className="text-gray-400 hover:text-white transition">
                  {t.footer.orderLookup}
                </Link>
                <Link href="/terms" className="text-gray-400 hover:text-white transition">
                  {t.footer.terms}
                </Link>
                <Link href="/privacy" className="text-gray-400 hover:text-white transition">
                  {t.footer.privacy}
                </Link>
              </div>
            </div>

            {/* Language Selector */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                {t.langSelector.selectLanguage}
              </h3>
              <LanguageSelector variant="footer" />
            </div>
          </div>
        </div>

        {/* Bottom area - Business info */}
        <div className="py-6 sm:py-8">
          <div className="text-xs sm:text-sm text-gray-400 leading-relaxed space-y-1">
            <p>
              <span className="font-semibold text-gray-300">{t.footer.companyName}</span>
              <span className="mx-2 text-gray-600">|</span>
              <span className="font-semibold text-gray-300">{t.footer.representative} : </span>노성규
            </p>
            <p>
              <span className="font-semibold text-gray-300">{t.footer.businessNumber} : </span>390-87-03804
              <span className="mx-2 text-gray-600">|</span>
              <span className="font-semibold text-gray-300">{t.footer.salesNumber} : </span>2026-서울강남-00795
            </p>
            <p>
              <span className="font-semibold text-gray-300">{t.footer.address} : </span>서울특별시 강남구 테헤란로79길 6, 3층 브이1093(삼성동, 제이에스타워)
            </p>
            <p>
              <span className="font-semibold text-gray-300">{t.footer.landline} : </span>
              <a href="tel:02-1551-4220" className="hover:text-white transition">02-1551-4220</a>
            </p>
          </div>

          {/* Copyright */}
          <div className="mt-6 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500 text-center">
              &copy; {new Date().getFullYear()} {t.footer.copyright}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
