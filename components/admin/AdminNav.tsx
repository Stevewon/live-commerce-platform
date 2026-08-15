'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * 관리자 공통 상단 내비게이션 (단일 소스).
 *
 * [2026-08-06] 이전에는 각 어드민 페이지가 상단 메뉴를 제각각 하드코딩하여
 * 페이지마다 메뉴 항목·순서·색상·개수가 전부 달랐다("매번 상단이 다 틀림").
 * 이 컴포넌트로 메뉴를 한 곳에 고정하고, app/admin/layout.tsx 에서 렌더하여
 * 모든 어드민 화면이 동일한 상단을 쓰도록 통일한다.
 *
 * 현재 경로는 usePathname 으로 자동 하이라이트한다.
 */

interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** 정확 일치로만 활성화(대시보드 '/admin' 처럼 하위 경로와 충돌 방지) */
  exact?: boolean;
}

// ★ 메뉴 정본(canonical). 순서·라벨·아이콘을 여기서만 관리한다.
const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: '대시보드', icon: '📊', exact: true },
  { href: '/admin/users', label: '회원 관리', icon: '👥' },
  { href: '/admin/balance-requests', label: '무통장입금 승인', icon: '💳' },
  { href: '/admin/orders', label: '주문 관리', icon: '📦' },
  { href: '/admin/inquiries', label: '고객 문의', icon: '💬' },
  { href: '/admin/japan-shipping', label: '일본 배송비', icon: '🚢' },
  { href: '/admin/partners', label: '파트너 관리', icon: '🤝' },
  { href: '/admin/products', label: '상품 관리', icon: '🛍️' },
  { href: '/admin/reviews', label: '리뷰 관리', icon: '⭐' },
  { href: '/admin/categories', label: '카테고리 관리', icon: '🏷️' },
  { href: '/admin/settlements', label: '정산 관리', icon: '💰' },
  { href: '/admin/coupons', label: '쿠폰 관리', icon: '🎟️' },
  { href: '/admin/reports', label: '매출 리포트', icon: '📈' },
  { href: '/admin/settings', label: '설정', icon: '⚙️' },
];

function isActive(pathname: string | null, item: NavItem): boolean {
  if (!pathname) return false;
  if (item.exact) return pathname === item.href;
  // 하위 경로 포함 (예: /admin/products/new 도 '상품 관리' 활성화)
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6">
      <div className="bg-white rounded-2xl shadow-lg p-2 flex flex-wrap gap-1.5 border border-gray-200">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-xl shadow-md font-semibold text-sm flex items-center gap-1.5 whitespace-nowrap'
                  : 'px-3.5 py-2 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-semibold text-sm flex items-center gap-1.5 whitespace-nowrap'
              }
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
