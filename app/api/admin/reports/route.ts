import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// GET /api/admin/reports - 월별 매출/취소 리포트
export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = searchParams.get('month'); // optional: specific month (1-12)
    const type = searchParams.get('type') || 'monthly'; // 'monthly' or 'cancellations'

    if (type === 'monthly') {
      // 월별 매출 집계
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year + 1, 0, 1);

      const orders = await prisma.order.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lt: endDate,
          },
        },
        select: {
          id: true,
          total: true,
          subtotal: true,
          shippingFee: true,
          discount: true,
          status: true,
          createdAt: true,
          partnerRevenue: true,
          platformRevenue: true,
        },
        orderBy: { createdAt: 'asc' }
      });

      // 월별로 그룹핑
      const monthlyData: Record<number, {
        month: number;
        totalSales: number;
        totalOrders: number;
        cancelledAmount: number;
        cancelledOrders: number;
        refundedAmount: number;
        refundedOrders: number;
        confirmedSales: number;
        confirmedOrders: number;
        shippingOrders: number;
        deliveredOrders: number;
        pendingOrders: number;
        partnerRevenue: number;
        platformRevenue: number;
        avgOrderValue: number;
      }> = {};

      for (let m = 1; m <= 12; m++) {
        monthlyData[m] = {
          month: m,
          totalSales: 0,
          totalOrders: 0,
          cancelledAmount: 0,
          cancelledOrders: 0,
          refundedAmount: 0,
          refundedOrders: 0,
          confirmedSales: 0,
          confirmedOrders: 0,
          shippingOrders: 0,
          deliveredOrders: 0,
          pendingOrders: 0,
          partnerRevenue: 0,
          platformRevenue: 0,
          avgOrderValue: 0,
        };
      }

      for (const order of orders) {
        const m = new Date(order.createdAt).getMonth() + 1;
        const data = monthlyData[m];
        
        data.totalOrders++;
        data.totalSales += order.total;

        if (order.status === 'CANCELLED') {
          data.cancelledAmount += order.total;
          data.cancelledOrders++;
        } else if (order.status === 'REFUNDED') {
          data.refundedAmount += order.total;
          data.refundedOrders++;
        } else if (order.status === 'CONFIRMED') {
          data.confirmedSales += order.total;
          data.confirmedOrders++;
        } else if (order.status === 'SHIPPING') {
          data.shippingOrders++;
          data.confirmedSales += order.total;
        } else if (order.status === 'DELIVERED') {
          data.deliveredOrders++;
          data.confirmedSales += order.total;
        } else if (order.status === 'PENDING') {
          data.pendingOrders++;
        }

        data.partnerRevenue += order.partnerRevenue || 0;
        data.platformRevenue += order.platformRevenue || 0;
      }

      // 평균 주문 금액 계산
      for (const m of Object.keys(monthlyData)) {
        const data = monthlyData[parseInt(m)];
        const activeOrders = data.totalOrders - data.cancelledOrders - data.refundedOrders;
        data.avgOrderValue = activeOrders > 0 ? Math.round(data.totalSales / activeOrders) : 0;
      }

      // 연간 합계
      const yearSummary = {
        totalSales: Object.values(monthlyData).reduce((sum, d) => sum + d.totalSales, 0),
        totalOrders: Object.values(monthlyData).reduce((sum, d) => sum + d.totalOrders, 0),
        cancelledAmount: Object.values(monthlyData).reduce((sum, d) => sum + d.cancelledAmount, 0),
        cancelledOrders: Object.values(monthlyData).reduce((sum, d) => sum + d.cancelledOrders, 0),
        refundedAmount: Object.values(monthlyData).reduce((sum, d) => sum + d.refundedAmount, 0),
        refundedOrders: Object.values(monthlyData).reduce((sum, d) => sum + d.refundedOrders, 0),
        partnerRevenue: Object.values(monthlyData).reduce((sum, d) => sum + d.partnerRevenue, 0),
        platformRevenue: Object.values(monthlyData).reduce((sum, d) => sum + d.platformRevenue, 0),
      };

      return NextResponse.json({
        success: true,
        year,
        monthlyData: Object.values(monthlyData),
        summary: yearSummary,
      });
    }

    if (type === 'cancellations') {
      // 취소/환불 상세 내역
      const targetMonth = month ? parseInt(month) : null;
      
      let startDate: Date;
      let endDate: Date;
      
      if (targetMonth) {
        startDate = new Date(year, targetMonth - 1, 1);
        endDate = new Date(year, targetMonth, 1);
      } else {
        startDate = new Date(year, 0, 1);
        endDate = new Date(year + 1, 0, 1);
      }

      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const offset = (page - 1) * limit;

      const where: any = {
        status: { in: ['CANCELLED', 'REFUNDED'] },
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      };

      const [cancellations, total] = await Promise.all([
        prisma.order.findMany({
          where,
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            cancelReason: true,
            cancelledAt: true,
            refundAmount: true,
            refundedAt: true,
            createdAt: true,
            user: {
              select: {
                name: true,
                email: true,
              }
            },
            partner: {
              select: {
                storeName: true,
              }
            },
            items: {
              select: {
                quantity: true,
                price: true,
                product: {
                  select: {
                    name: true,
                  }
                }
              }
            }
          },
          orderBy: { cancelledAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.order.count({ where }),
      ]);

      // 취소/환불 통계
      const stats = await prisma.order.aggregate({
        where: {
          status: { in: ['CANCELLED', 'REFUNDED'] },
          createdAt: {
            gte: startDate,
            lt: endDate,
          },
        },
        _sum: {
          total: true,
          refundAmount: true,
        },
        _count: {
          id: true,
        },
      });

      const cancelCount = await prisma.order.count({
        where: {
          status: 'CANCELLED',
          createdAt: { gte: startDate, lt: endDate },
        },
      });

      const refundCount = await prisma.order.count({
        where: {
          status: 'REFUNDED',
          createdAt: { gte: startDate, lt: endDate },
        },
      });

      const totalOrderCount = await prisma.order.count({
        where: {
          createdAt: { gte: startDate, lt: endDate },
        },
      });

      return NextResponse.json({
        success: true,
        year,
        month: targetMonth,
        cancellations,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          totalCancelledRefunded: stats._count.id,
          totalAmount: stats._sum.total || 0,
          refundedAmount: stats._sum.refundAmount || 0,
          cancelCount,
          refundCount,
          totalOrderCount,
          cancellationRate: totalOrderCount > 0 
            ? Math.round((stats._count.id / totalOrderCount) * 10000) / 100 
            : 0,
        },
      });
    }

    return NextResponse.json({ error: '유효하지 않은 리포트 타입입니다' }, { status: 400 });
  } catch (error: any) {
    console.error('Admin reports error:', error);
    return NextResponse.json({ error: '리포트 조회 실패' }, { status: 500 });
  }
}
