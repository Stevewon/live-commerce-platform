import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

/**
 * GET /api/admin/dashboard
 * 
 * 관리자 대시보드 통계 + 최근 주문 + 파트너 목록
 * 
 * [2026-05-11 PERF FIX] 어드민 페이지 느린 로딩 최적화
 * - 이전: prisma.order.findMany() 로 전체 주문을 메모리에 로드 후 JS에서 통계 계산
 *   → 주문 수가 증가할수록 응답 시간이 선형 증가 (수천 건 시 수 초~수십 초)
 * - 수정: DB 레벨 집계 쿼리 사용 (aggregate, count, groupBy)
 *   → 주문 수에 관계없이 일정한 응답 속도 (수백 ms 이내)
 * - 모든 쿼리를 Promise.all()로 병렬 실행하여 총 응답 시간 최소화
 */
export async function GET(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(request);
    if (authResult instanceof NextResponse) return authResult;
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      )
    }

    // 오늘 날짜 계산 (한국 시간 기준 자정 → UTC 변환)
    // [D1_TYPE_ERROR FIX] D1 (Cloudflare SQLite) 가 Date 객체 바인딩 거부 → 반드시 ISO string 사용
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000 // UTC+9
    const kstNow = new Date(now.getTime() + kstOffset)
    const todayStartDate = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate())
    todayStartDate.setTime(todayStartDate.getTime() - kstOffset) // KST 자정을 UTC로 변환
    const todayStart = todayStartDate.toISOString()

    // ★ 모든 쿼리를 병렬 실행하여 응답 시간 최소화
    const [
      // 전체 주문 통계 (DB 집계)
      totalRevenueResult,
      totalOrderCount,
      pendingOrderCount,
      // 오늘 주문 통계 (DB 집계)
      todayRevenueResult,
      todayOrderCount,
      // 기타 카운트
      totalPartners,
      totalProducts,
      totalCustomers,
      // 최근 주문 10건 (UI 표시용)
      recentOrders,
      // 파트너 목록 (UI 표시용)
      partners,
    ] = await Promise.all([
      // 전체 매출 합계
      prisma.order.aggregate({
        _sum: { total: true },
        where: {
          status: { in: ['CONFIRMED', 'SHIPPING', 'DELIVERED'] },
        },
      }),
      // 전체 주문 수
      prisma.order.count(),
      // 대기 중 주문 수
      prisma.order.count({ where: { status: 'PENDING' } }),
      // 오늘 매출 합계
      prisma.order.aggregate({
        _sum: { total: true },
        where: {
          createdAt: { gte: todayStart },
          status: { in: ['CONFIRMED', 'SHIPPING', 'DELIVERED'] },
        },
      }),
      // 오늘 주문 수
      prisma.order.count({
        where: { createdAt: { gte: todayStart } },
      }),
      // 활성 파트너 수
      prisma.partner.count({ where: { isActive: true } }),
      // 활성 상품 수
      prisma.product.count({ where: { isActive: true } }),
      // 고객 수
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      // 최근 주문 10건
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          partner: { select: { storeName: true } },
          user: { select: { name: true } },
        },
      }),
      // 파트너 목록 (주문 수 포함)
      prisma.partner.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          _count: { select: { orders: true } },
        },
      }),
    ]);

    const totalRevenue = totalRevenueResult._sum.total || 0;
    const todayRevenue = todayRevenueResult._sum.total || 0;

    return NextResponse.json({
      stats: {
        totalRevenue,
        totalOrders: totalOrderCount,
        totalProducts,
        totalPartners,
        totalCustomers,
        pendingOrders: pendingOrderCount,
        todayRevenue,
        todayOrders: todayOrderCount,
      },
      recentOrders,
      partners,
    })

  } catch (error: any) {
    console.error('Admin Dashboard API error:', error)
    return NextResponse.json(
      {
        error: '데이터를 불러오는 중 오류가 발생했습니다',
        debugMessage: error?.message || String(error),
        debugStack: (error?.stack || '').split('\n').slice(0, 5).join(' | '),
      },
      { status: 500 }
    )
  }
}
