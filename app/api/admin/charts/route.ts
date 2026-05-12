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
    // [D1_TYPE_ERROR FIX] D1 가 Date 객체 바인딩 거부 → ISO string 사용
    const sevenDaysAgoDate = new Date();
    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);
    const sevenDaysAgo = sevenDaysAgoDate.toISOString();
    
    // 최근 30일 범위 (시간대별 통계용 - 전체 주문 대신 30일로 제한)
    const thirtyDaysAgoDate = new Date();
    thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30);
    const thirtyDaysAgo = thirtyDaysAgoDate.toISOString();

    // [D1 WRAPPER FIX v2] orderItem.groupBy 자체가 D1 wrapper 에서
    // `c2.toUpperCase is not a function` 으로 죽음 (nested where 제거 후에도 동일).
    // → groupBy 호출 완전 제거, raw SQL 로 직접 집계 (D1 안전)
    const [
      recentOrders,
      categoryStatsRaw,
      hourlyOrders,
      topProductsRawSql,
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

      // 2) 카테고리별 매출 — raw SQL groupBy
      prisma.$queryRawUnsafe(`
        SELECT oi."productId" as productId,
               SUM(oi."quantity") as quantity,
               SUM(oi."price") as price
        FROM "OrderItem" oi
        INNER JOIN "Order" o ON o."id" = oi."orderId"
        WHERE o."status" NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY oi."productId"
      `),

      // 3) 시간대별 주문 (최근 30일로 제한 - 이전: 전체 조회)
      prisma.order.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true },
      }),

      // 4) 인기 상품 Top 5 — raw SQL groupBy + orderBy
      prisma.$queryRawUnsafe(`
        SELECT oi."productId" as productId,
               SUM(oi."quantity") as quantity,
               SUM(oi."price") as price,
               COUNT(oi."id") as cnt
        FROM "OrderItem" oi
        INNER JOIN "Order" o ON o."id" = oi."orderId"
        WHERE o."status" NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY oi."productId"
        ORDER BY SUM(oi."quantity") DESC
        LIMIT 5
      `),
    ]);

    // raw SQL 결과 → groupBy 결과와 동일한 형태로 정규화
    const categoryStats = (Array.isArray(categoryStatsRaw) ? categoryStatsRaw : []).map((r: any) => ({
      productId: r.productId,
      _sum: { quantity: Number(r.quantity) || 0, price: Number(r.price) || 0 },
    }));
    const topProductsRaw = (Array.isArray(topProductsRawSql) ? topProductsRawSql : []).map((r: any) => ({
      productId: r.productId,
      _sum: { quantity: Number(r.quantity) || 0, price: Number(r.price) || 0 },
      _count: { id: Number(r.cnt) || 0 },
    }));

    // --- 1) 일별 매출 그룹화 ---
    // [SAFE] D1 에서 createdAt 이 string 또는 Date 어느쪽으로 와도 안전하게 처리
    const salesByDate: Record<string, { sales: number; orders: number }> = {};
    recentOrders.forEach((order: any) => {
      const d = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt);
      const dateKey = d.toISOString().split('T')[0];
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

    hourlyOrders.forEach((order: any) => {
      const d = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt);
      const hour = d.getHours();
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
