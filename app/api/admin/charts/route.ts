// app/api/admin/charts/route.ts
// 관리자 대시보드 차트 데이터 API
//
// [2026-05-11 PERF FIX] 어드민 차트 데이터 로딩 최적화
// - 이전: prisma.order.findMany() 전체 조회 후 JS에서 시간대별 집계
//   → 주문 수 증가 시 메모리/시간 소모 선형 증가
// - 수정: 7일 범위 제한 + 병렬 쿼리 실행으로 응답 속도 대폭 개선

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    const tokenResult = await verifyAuthToken(req);
    if (tokenResult instanceof NextResponse) return tokenResult;
    
    const { role } = tokenResult;
    
    if (role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 최근 7일 범위
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // 최근 30일 범위 (시간대별 통계용 - 전체 주문 대신 30일로 제한)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // ★ 모든 독립 쿼리를 병렬 실행
    const [
      recentOrders,
      categoryStats,
      hourlyOrders,
      topProductsRaw,
    ] = await Promise.all([
      // 1) 최근 7일 매출 추이
      prisma.order.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
        select: {
          createdAt: true,
          total: true,
        },
      }),

      // 2) 카테고리별 매출
      prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true, price: true },
        where: {
          order: {
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
          },
        },
      }),

      // 3) 시간대별 주문 (최근 30일로 제한 - 이전: 전체 조회)
      prisma.order.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true },
      }),

      // 4) 인기 상품 Top 5
      prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true, price: true },
        _count: { id: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
        where: {
          order: {
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
          },
        },
      }),
    ]);

    // --- 1) 일별 매출 그룹화 ---
    const salesByDate: Record<string, { sales: number; orders: number }> = {};
    recentOrders.forEach((order) => {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = { sales: 0, orders: 0 };
      }
      salesByDate[dateKey].sales += order.total;
      salesByDate[dateKey].orders += 1;
    });

    const salesTrend = Object.entries(salesByDate)
      .map(([date, data]) => ({
        date,
        sales: data.sales,
        orders: data.orders,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // --- 2) 카테고리별 매출 ---
    const productIds = categoryStats.map((s) => s.productId);
    const products = productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            categoryId: true,
            category: { select: { name: true } },
          },
        })
      : [];

    const categorySales: Record<string, { revenue: number; count: number }> = {};
    categoryStats.forEach((stat) => {
      const product = products.find((p) => p.id === stat.productId);
      if (product) {
        const catName = product.category.name;
        const revenue = (stat._sum.price || 0) * (stat._sum.quantity || 0);
        if (!categorySales[catName]) {
          categorySales[catName] = { revenue: 0, count: 0 };
        }
        categorySales[catName].revenue += revenue;
        categorySales[catName].count += stat._sum.quantity || 0;
      }
    });

    const categoryData = Object.entries(categorySales).map(([category, data]) => ({
      category,
      revenue: data.revenue,
      count: data.count,
    }));

    // --- 3) 시간대별 주문 (24시간) ---
    const ordersByHour = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour}시`,
      count: 0,
    }));

    hourlyOrders.forEach((order) => {
      const hour = order.createdAt.getHours();
      ordersByHour[hour].count++;
    });

    // --- 4) 인기 상품 Top 5 ---
    const topProductIds = topProductsRaw.map((p) => p.productId);
    const topProductDetails = topProductIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: {
            id: true,
            name: true,
            thumbnail: true,
            price: true,
          },
        })
      : [];

    const topProducts = topProductsRaw.map((stat) => {
      const product = topProductDetails.find((p) => p.id === stat.productId);
      return {
        name: product?.name || '알 수 없음',
        sales: stat._sum.quantity || 0,
        orders: stat._count.id || 0,
        revenue: (stat._sum.price || 0) * (stat._sum.quantity || 0),
      };
    });

    return NextResponse.json({
      salesTrend,
      categoryData,
      ordersByHour,
      topProducts,
    });
  } catch (error: any) {
    console.error('차트 데이터 조회 오류:', error);
    return NextResponse.json(
      {
        error: '차트 데이터를 불러올 수 없습니다',
        debugMessage: error?.message || String(error),
        debugStack: (error?.stack || '').split('\n').slice(0, 5).join(' | '),
      },
      { status: 500 }
    );
  }
}
