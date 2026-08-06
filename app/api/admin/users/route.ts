import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users
 *
 * 관리자 회원 목록 조회.
 *
 * [2026-08-06 PERF FIX] 회원관리 페이지 느린 로딩 최적화
 * - 이전: prisma.user.findMany({ include: { _count: { orders } } })
 *   → 회원 1명마다 주문 수 서브쿼리(N+1). 회원 수가 늘수록 응답 시간 선형 증가.
 *   → 대시보드는 [2026-05-11] 최적화했으나 users API 는 최적화에서 누락되어 있었음.
 * - 수정:
 *   1) _count(include) 제거 → OrderItem 이 아닌 Order 를 userId 로 groupBy 하여
 *      주문 수를 단 한 번의 집계 쿼리로 계산 후 메모리에서 매핑.
 *   2) select 로 필요한 컬럼만 조회하여 payload 축소.
 *   3) role 별 카운트를 DB groupBy 로 집계하여 stats 로 함께 반환(프론트 카드용).
 *   4) 회원 목록 조회 + 주문수 groupBy + role 집계를 Promise.all 로 병렬 실행.
 * - 응답 형태(`data` 배열, 각 항목의 `_count.orders`)는 기존과 동일하게 유지하여
 *   프론트(app/admin/users/page.tsx) 하위호환을 보장.
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
      );
    }

    // ★ 모든 쿼리를 병렬 실행하여 응답 시간 최소화
    const [users, orderCounts, roleCounts] = await Promise.all([
      // 회원 목록 (필요한 컬럼만 select → payload 축소, _count include 제거)
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          nickname: true,
          name: true,
          phone: true,
          role: true,
          emailVerified: true,
          createdAt: true,
        },
      }),
      // 주문 수를 userId 기준으로 한 번에 집계 (N+1 제거)
      prisma.order.groupBy({
        by: ['userId'],
        _count: { _all: true },
      }),
      // 역할별 회원 수 집계 (프론트 통계 카드용)
      prisma.user.groupBy({
        by: ['role'],
        _count: { _all: true },
      }),
    ]);

    // userId → 주문 수 매핑
    const orderCountMap = new Map<string, number>();
    for (const row of orderCounts as Array<{ userId: string | null; _count: { _all: number } }>) {
      if (row.userId) orderCountMap.set(row.userId, row._count._all);
    }

    // 기존 응답 형태(_count.orders)를 유지하여 프론트 하위호환 보장
    const data = users.map((u) => ({
      ...u,
      _count: { orders: orderCountMap.get(u.id) || 0 },
    }));

    // 역할별/전체 카운트 집계
    const roleCountMap: Record<string, number> = {};
    for (const row of roleCounts as Array<{ role: string; _count: { _all: number } }>) {
      roleCountMap[row.role] = row._count._all;
    }

    return NextResponse.json({
      success: true,
      data,
      stats: {
        total: users.length,
        customers: roleCountMap['CUSTOMER'] || 0,
        partners: roleCountMap['PARTNER'] || 0,
        admins: roleCountMap['ADMIN'] || 0,
      },
    });

  } catch (error) {
    console.error('회원 목록 조회 실패:', error);
    return NextResponse.json(
      { error: '회원 목록을 불러오는 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
