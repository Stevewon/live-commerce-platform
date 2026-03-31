'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function Footer() {
  const pathname = usePathname();

  // 관리자/파트너 대시보드에서는 푸터 숨김
  if (pathname.startsWith('/admin') || pathname.startsWith('/partner')) {
    return null;
  }

  return (
    <footer className="bg-gray-900 text-gray-300 pb-20 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 상단 영역 - 로고 + 링크 */}
        <div className="py-8 sm:py-12 border-b border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* 브랜드 */}
            <div>
              <h2 className="text-xl font-bold text-white mb-3">
                🛍️ 큐라이브 (QRLIVE)
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                라이브 스트리머를 위한 분양형 쇼핑몰 플랫폼.<br />
                실시간 라이브 방송과 쇼핑을 한번에!
              </p>
            </div>

            {/* 고객센터 */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                고객센터
              </h3>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-gray-400">전화 : </span>
                  <a href="tel:02-1551-4220" className="text-gray-300 hover:text-white transition">
                    02-1551-4220
                  </a>
                </p>
                <p className="text-gray-400">
                  평일 10:00 ~ 18:00 (점심 12:00 ~ 13:00)
                </p>
                <p className="text-gray-400">
                  토·일·공휴일 휴무
                </p>
              </div>
            </div>

            {/* 바로가기 */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                바로가기
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Link href="/products" className="text-gray-400 hover:text-white transition">
                  쇼핑
                </Link>
                <Link href="/orders/lookup" className="text-gray-400 hover:text-white transition">
                  주문조회
                </Link>
                <Link href="/terms" className="text-gray-400 hover:text-white transition">
                  이용약관
                </Link>
                <Link href="/privacy" className="text-gray-400 hover:text-white transition">
                  개인정보처리방침
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 영역 - 사업자 정보 (토스페이먼츠 심사 필수) */}
        <div className="py-6 sm:py-8">
          <div className="text-xs sm:text-sm text-gray-400 leading-relaxed space-y-1">
            <p>
              <span className="font-semibold text-gray-300">상호명 : </span>주식회사 퀀타리움
              <span className="mx-2 text-gray-600">|</span>
              <span className="font-semibold text-gray-300">대표자명 : </span>노성규
            </p>
            <p>
              <span className="font-semibold text-gray-300">사업자등록번호 : </span>390-87-03804
              <span className="mx-2 text-gray-600">|</span>
              <span className="font-semibold text-gray-300">통신판매업신고번호 : </span>2026-서울강남-00795
            </p>
            <p>
              <span className="font-semibold text-gray-300">사업장주소 : </span>서울특별시 강남구 테헤란로79길 6, 3층 브이1093(삼성동, 제이에스타워)
            </p>
            <p>
              <span className="font-semibold text-gray-300">유선전화번호 : </span>
              <a href="tel:02-1551-4220" className="hover:text-white transition">02-1551-4220</a>
            </p>
          </div>

          {/* 카피라이트 */}
          <div className="mt-6 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500 text-center">
              &copy; {new Date().getFullYear()} 주식회사 퀀타리움. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
