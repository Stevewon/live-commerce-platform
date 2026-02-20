// app/api/partner/charts/route.ts
// 파트너 대시보드 차트 데이터 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

export async function GET(req: NextRequest) {
  try {
    const tokenResult = await verifyAuthToken(req);
    if (tokenResult instanceof NextResponse) return tokenResult;
    
    const { userId, role } = tokenResult;
    
    if (role !== 'PARTNER') {
      return NextResponse.json(
        { success: false, error: '파트너 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 파트너 정보 조회
    const partner = await prisma.partner.findUnique({
      where: { userId },
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: '파트너 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 최근 30일 매출 추이
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const orders = await prisma.order.findMany({
      where: {
        partnerId: partner.id,
        createdAt: { gte: thirtyDaysAgo },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      select: {
        createdAt: true,
        partnerRevenue: true,
      },
    });

    // 일별 매출 그룹화
    const salesByDate: Record<string, number> = {};
    orders.forEach((order) => {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      salesByDate[dateKey] = (salesByDate[dateKey] || 0) + (order.partnerRevenue || 0);
    });

    const salesTrend = Object.entries(salesByDate)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 상품별 판매 현황 (Top 10)
    const productSales = await prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true, price: true },
      where: {
        order: {
          partnerId: partner.id,
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
      },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    });

    const productIds = productSales.map((s) => s.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        thumbnail: true,
        price: true,
      },
    });

    const topProducts = productSales.map((stat) => {
      const product = products.find((p) => p.id === stat.productId);
      return {
        id: stat.productId,
        name: product?.name || '알 수 없음',
        thumbnail: product?.thumbnail || '',
        price: product?.price || 0,
        soldCount: stat._sum.quantity || 0,
        revenue: (stat._sum.price || 0) * (stat._sum.quantity || 0),
      };
    });

    // 주문 상태별 분포
    const orderStatusCounts = await prisma.order.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { partnerId: partner.id },
    });

    const statusDistribution = orderStatusCounts.map((stat) => ({
      status: stat.status,
      count: stat._count.id,
    }));

    return NextResponse.json({
      success: true,
      data: {
        salesTrend,
        topProducts,
        statusDistribution,
      },
    });
  } catch (error: any) {
    console.error('파트너 차트 데이터 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '차트 데이터를 불러올 수 없습니다' },
      { status: 500 }
    );
  }
}
