'use client';

import { usePathname } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';

/**
 * 관리자 공통 레이아웃.
 *
 * [2026-08-06] 어드민 상단 내비게이션을 이 레이아웃에서 단 한 번 렌더하여
 * 모든 어드민 화면이 동일한 상단 메뉴를 쓰도록 고정한다.
 * (이전: 각 페이지가 상단 메뉴를 제각각 하드코딩 → 페이지마다 상단이 달랐음)
 *
 * 단, 로그인 페이지(/admin/login)는 인증 전 화면이므로 nav 를 렌더하지 않는다.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname === '/admin/login';

  if (hideNav) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdminNav />
      </div>
      {children}
    </div>
  );
}
