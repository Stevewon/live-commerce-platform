import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { ensureOrderIndexes } from '@/lib/ensureProductColumns';

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

    // [PERF] 주문 조회 인덱스 셀프 힐링 (Order.status/createdAt 집계 가속)
    try { await ensureOrderIndexes(); } catch { /* 실패해도 조회는 진행 */ }

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = searchParams.get('month'); // optional: specific month (1-12)
    const type = searchParams.get('type') || 'monthly'; // 'monthly' or 'cancellations'

    if (type === 'monthly') {
      // 월별 매출 집계
      // [D1_TYPE_ERROR FIX] D1 가 Date 객체 바인딩 거부 → ISO string 사용
      const startDate = new Date(year, 0, 1).toISOString();
      const endDate = new Date(year + 1, 0, 1).toISOString();

      // [2026-08-06 PERF FIX] 월별 리포트 DB 집계로 전환
      // - 이전: 1년치 주문 전체를 findMany 로 메모리에 로드 후 JS 루프로 12개월 집계.
      //   → 주문 수 증가 시 응답 시간/메모리 선형 증가.
      // - 수정: 단일 raw SQL 로 (월 × 상태) 집계 → 주문 수와 무관하게 일정 속도.
      //   · 월 그룹핑은 strftime('%m', createdAt) (D1 SQLite = UTC 기준)로 계산.
      //     기존 JS 는 Workers(UTC) 에서 new Date().getMonth() 도 UTC 로 동작하므로
      //     동일 결과. price/revenue 합계·건수도 조건부 SUM 으로 1:1 이식.
      const aggRows = await prisma.$queryRawUnsafe(
        `SELECT
           CAST(strftime('%m', "createdAt") AS INTEGER) as m,
           "status" as status,
           COUNT(*) as cnt,
           SUM("total") as sumTotal,
           SUM(COALESCE("partnerRevenue", 0)) as sumPartner,
           SUM(COALESCE("platformRevenue", 0)) as sumPlatform
         FROM "Order"
         WHERE "createdAt" >= ? AND "createdAt" < ?
         GROUP BY m, "status"`,
        startDate,
        endDate,
      );

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

      // (월 × 상태) 집계 행을 기존 JS 분기 로직과 동일하게 반영
      type AggRow = { m: string | number; status: string; cnt: number; sumTotal: number; sumPartner: number; sumPlatform: number };
      const aggList: AggRow[] = Array.isArray(aggRows) ? (aggRows as AggRow[]) : [];
      for (const row of aggList) {
        const m = Number(row.m);
        if (!m || m < 1 || m > 12) continue;
        const data = monthlyData[m];
        const cnt = Number(row.cnt) || 0;
        const sumTotal = Number(row.sumTotal) || 0;
        const status = row.status;

        data.totalOrders += cnt;
        data.totalSales += sumTotal;

        if (status === 'CANCELLED') {
          data.cancelledAmount += sumTotal;
          data.cancelledOrders += cnt;
        } else if (status === 'REFUNDED') {
          data.refundedAmount += sumTotal;
          data.refundedOrders += cnt;
        } else if (status === 'CONFIRMED') {
          data.confirmedSales += sumTotal;
          data.confirmedOrders += cnt;
        } else if (status === 'SHIPPING') {
          data.shippingOrders += cnt;
          data.confirmedSales += sumTotal;
        } else if (status === 'DELIVERED') {
          data.deliveredOrders += cnt;
          data.confirmedSales += sumTotal;
        } else if (status === 'PENDING') {
          data.pendingOrders += cnt;
        }

        data.partnerRevenue += Number(row.sumPartner) || 0;
        data.platformRevenue += Number(row.sumPlatform) || 0;
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
      // [D1_TYPE_ERROR FIX] D1 가 Date 객체 바인딩 거부 → ISO string 사용
      const targetMonth = month ? parseInt(month) : null;
      
      let startDate: string;
      let endDate: string;
      
      if (targetMonth) {
        startDate = new Date(year, targetMonth - 1, 1).toISOString();
        endDate = new Date(year, targetMonth, 1).toISOString();
      } else {
        startDate = new Date(year, 0, 1).toISOString();
        endDate = new Date(year + 1, 0, 1).toISOString();
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

      // [2026-08-06 PERF FIX] 취소/환불 통계 count 3종 + aggregate 를 병렬 실행
      // (이전: stats → cancelCount → refundCount → totalOrderCount 순차 await)
      const [stats, cancelCount, refundCount, totalOrderCount] = await Promise.all([
        prisma.order.aggregate({
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
        }),
        prisma.order.count({
          where: {
            status: 'CANCELLED',
            createdAt: { gte: startDate, lt: endDate },
          },
        }),
        prisma.order.count({
          where: {
            status: 'REFUNDED',
            createdAt: { gte: startDate, lt: endDate },
          },
        }),
        prisma.order.count({
          where: {
            createdAt: { gte: startDate, lt: endDate },
          },
        }),
      ]);

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
