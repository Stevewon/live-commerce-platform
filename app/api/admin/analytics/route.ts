import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
  const prisma = await getPrisma();
  try {
    // 인증 확인
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 쿼리 파라미터에서 기간 가져오기
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30'; // 기본 30일
    const days = parseInt(period);

    // 기간 설정
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 일별 매출 및 주문 수
    const dailyStats = await prisma.$queryRaw<Array<{
      date: Date;
      revenue: number;
      orders: number;
    }>>`
      SELECT 
        DATE(createdAt) as date,
        SUM(total) as revenue,
        COUNT(*) as orders
      FROM Order
      WHERE createdAt >= ${startDate}
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `;

    // 상태별 주문 수
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: {
        id: true
      },
      where: {
        createdAt: {
          gte: startDate
        }
      }
    });

    // 카테고리별 매출
    const salesByCategory = await prisma.$queryRaw<Array<{
      categoryName: string;
      revenue: number;
      orders: number;
    }>>`
      SELECT 
        c.name as categoryName,
        SUM(oi.price * oi.quantity) as revenue,
        COUNT(DISTINCT o.id) as orders
      FROM Order o
      JOIN OrderItem oi ON oi.orderId = o.id
      JOIN Product p ON p.id = oi.productId
      JOIN Category c ON c.id = p.categoryId
      WHERE o.createdAt >= ${startDate}
      GROUP BY c.name
      ORDER BY revenue DESC
    `;

    // 파트너별 매출 TOP 10
    const topPartners = await prisma.order.groupBy({
      by: ['partnerId'],
      _sum: {
        total: true,
        partnerRevenue: true
      },
      _count: {
        id: true
      },
      where: {
        createdAt: {
          gte: startDate
        },
        partnerId: {
          not: null
        }
      },
      orderBy: {
        _sum: {
          total: 'desc'
        }
      },
      take: 10
    });

    // 파트너 정보 가져오기
    const partnerIds = topPartners.map(p => p.partnerId).filter(Boolean);
    const partners = await prisma.partner.findMany({
      where: {
        id: {
          in: partnerIds as string[]
        }
      },
      select: {
        id: true,
        storeName: true,
        storeSlug: true
      }
    });

    const topPartnersWithInfo = topPartners.map(p => {
      const partner = partners.find(partner => partner.id === p.partnerId);
      return {
        partnerId: p.partnerId,
        storeName: partner?.storeName || 'Unknown',
        storeSlug: partner?.storeSlug || '',
        revenue: p._sum.total || 0,
        partnerRevenue: p._sum.partnerRevenue || 0,
        orders: p._count.id
      };
    });

    // 인기 상품 TOP 10
    const topProducts = await prisma.$queryRaw<Array<{
      productId: string;
      productName: string;
      totalQuantity: number;
      revenue: number;
    }>>`
      SELECT 
        p.id as productId,
        p.name as productName,
        SUM(oi.quantity) as totalQuantity,
        SUM(oi.price * oi.quantity) as revenue
      FROM OrderItem oi
      JOIN Product p ON p.id = oi.productId
      JOIN Order o ON o.id = oi.orderId
      WHERE o.createdAt >= ${startDate}
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
      LIMIT 10
    `;

    // 신규 고객 추이
    const newCustomers = await prisma.$queryRaw<Array<{
      date: Date;
      count: number;
    }>>`
      SELECT 
        DATE(createdAt) as date,
        COUNT(*) as count
      FROM User
      WHERE role = 'CUSTOMER'
        AND createdAt >= ${startDate}
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `;

    return NextResponse.json({
      success: true,
      data: {
        dailyStats: dailyStats.map(stat => ({
          date: stat.date,
          revenue: Number(stat.revenue),
          orders: Number(stat.orders)
        })),
        ordersByStatus: ordersByStatus.map(s => ({
          status: s.status,
          count: s._count.id
        })),
        salesByCategory: salesByCategory.map(cat => ({
          category: cat.categoryName,
          revenue: Number(cat.revenue),
          orders: Number(cat.orders)
        })),
        topPartners: topPartnersWithInfo,
        topProducts: topProducts.map(prod => ({
          productId: prod.productId,
          name: prod.productName,
          quantity: Number(prod.totalQuantity),
          revenue: Number(prod.revenue)
        })),
        newCustomers: newCustomers.map(nc => ({
          date: nc.date,
          count: Number(nc.count)
        }))
      }
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '분석 데이터를 불러오는 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
