import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// 관리자 통계 조회 (GET)
export async function GET(req: NextRequest) {
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
          include: {
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

    // 4. 활성 파트너
    const activePartners = await prisma.partner.count({
      where: { isActive: true }
    });

    // 5. 대기 중인 정산
    const pendingSettlements = await prisma.settlement.count({
      where: { status: 'PENDING' }
    });

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
          pendingSettlements
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
        recentOrders
      }
    });

  } catch (error) {
    console.error('관리자 통계 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: '통계 조회에 실패했습니다' },
      { status: 500 }
    );
  }
}
