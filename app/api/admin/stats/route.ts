import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1 } from '@/lib/balance';
import { backfillOrderItemSnapshots } from '@/lib/orderItemSnapshot';

// 관리자 통계 조회 (GET)
export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    // 관리자 인증 확인
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 주문 상품명 스냅샷 보정 (상품 삭제/변경돼도 대시보드가 깨지지 않게)
    try {
      const d1 = await getD1();
      if (d1) await backfillOrderItemSnapshots(d1);
    } catch (e) {
      console.error('스냅샷 보정 실패(무시):', e);
    }

    // 1. 전체 통계
    const [
      totalOrders,
      totalUsers,
      totalPartners,
      totalProducts,
      totalRevenue,
      pendingOrders,
      shippingOrders,
      completedOrders,
    ] = await Promise.all([
      // 전체 주문 수
      prisma.order.count(),
      
      // 전체 사용자 수 (고객)
      prisma.user.count({
        where: { role: 'CUSTOMER' }
      }),
      
      // 전체 파트너 수
      prisma.partner.count(),
      
      // 전체 상품 수
      prisma.product.count(),
      
      // 전체 매출
      prisma.order.aggregate({
        where: {
          status: { in: ['CONFIRMED', 'SHIPPING', 'DELIVERED'] }
        },
        _sum: { total: true }
      }),
      
      // 대기 중인 주문
      prisma.order.count({
        where: { status: 'PENDING' }
      }),
      
      // 배송 중인 주문
      prisma.order.count({
        where: { status: 'SHIPPING' }
      }),
      
      // 완료된 주문
      prisma.order.count({
        where: { status: 'DELIVERED' }
      })
    ]);

    // 2. 오늘 통계
    // [D1_TYPE_ERROR FIX] D1 가 Date 객체 바인딩 거부 → ISO string 사용
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const today = todayDate.toISOString();

    const [todayOrders, todayRevenue, todayUsers] = await Promise.all([
      // 오늘 주문 수
      prisma.order.count({
        where: {
          createdAt: { gte: today }
        }
      }),
      
      // 오늘 매출
      prisma.order.aggregate({
        where: {
          createdAt: { gte: today },
          status: { in: ['CONFIRMED', 'SHIPPING', 'DELIVERED'] }
        },
        _sum: { total: true }
      }),
      
      // 오늘 가입 사용자
      prisma.user.count({
        where: {
          createdAt: { gte: today }
        }
      })
    ]);

    // 3. 최근 주문 (5개)
    const recentOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        items: {
          select: {
            productName: true,
            productThumbnail: true,
            product: {
              select: {
                name: true,
                thumbnail: true
              }
            }
          }
        }
      }
    });

    // 최근 주문 정규화: 상품 스냅샷 우선, user/product null 안전 처리
    const normalizedRecentOrders = (recentOrders as any[]).map((order) => ({
      ...order,
      user: order.user || { name: '비회원', email: '' },
      items: (order.items || []).map((item: any) => {
        const snapName = item.productName;
        const snapThumb = item.productThumbnail;
        return {
          ...item,
          product: {
            name: item.product?.name || snapName || '주문 상품',
            thumbnail: item.product?.thumbnail || snapThumb || null,
          },
        };
      }),
    }));

    // 4. 활성 파트너
    const activePartners = await prisma.partner.count({
      where: { isActive: true }
    });

    // 5. 대기 중인 정산
    const pendingSettlements = await prisma.settlement.count({
      where: { status: 'PENDING' }
    });

    // 6. 대기 중인 충전 신청 (한눈에 보이도록)
    let pendingBalanceRequests = 0;
    try {
      const d1 = await getD1();
      if (d1) {
        const row = (await d1
          .prepare(`SELECT COUNT(*) AS c FROM "BalanceRequest" WHERE "status" = 'PENDING'`)
          .first()) as { c?: number } | null;
        pendingBalanceRequests = Number(row?.c || 0);
      }
    } catch (e) {
      console.error('충전 신청 대기 건수 조회 실패(무시):', e);
    }

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalOrders,
          totalUsers,
          totalPartners,
          totalProducts,
          totalRevenue: totalRevenue._sum.total || 0,
          activePartners,
          pendingSettlements,
          pendingBalanceRequests
        },
        orderStatus: {
          pending: pendingOrders,
          shipping: shippingOrders,
          completed: completedOrders
        },
        today: {
          orders: todayOrders,
          revenue: todayRevenue._sum.total || 0,
          users: todayUsers
        },
        recentOrders: normalizedRecentOrders
      }
    });

  } catch (error: any) {
    console.error('관리자 통계 조회 실패:', error);
    return NextResponse.json(
      {
        success: false,
        error: '통계 조회에 실패했습니다',
        debugMessage: error?.message || String(error),
        debugStack: (error?.stack || '').split('\n').slice(0, 5).join(' | '),
      },
      { status: 500 }
    );
  }
}
