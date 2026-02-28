import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
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

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const partnerId = searchParams.get('partnerId');

    // 정산 내역 조회
    const where: any = {};
    if (status !== 'all') {
      where.status = status;
    }
    if (partnerId) {
      where.partnerId = partnerId;
    }

    const settlements = await prisma.settlement.findMany({
      where,
      include: {
        partner: {
          select: {
            storeName: true,
            storeSlug: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      data: settlements
    });

  } catch (error) {
    console.error('Get settlements error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '정산 내역 조회 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// 정산 자동 생성 API (POST)
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { partnerId, startDate, endDate } = body;

    // 기간 설정 (기본값: 지난 달)
    const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate) : new Date();

    // 파트너의 CONFIRMED 또는 DELIVERED 상태 주문 조회
    const orders = await prisma.order.findMany({
      where: {
        partnerId: partnerId || undefined,
        status: {
          in: ['CONFIRMED', 'DELIVERED']
        },
        createdAt: {
          gte: start,
          lte: end
        },
        // 이미 정산된 주문 제외
        // settlementId: null
      },
      include: {
        partner: {
          select: {
            id: true,
            storeName: true,
            commissionRate: true
          }
        }
      }
    });

    if (orders.length === 0) {
      return NextResponse.json({
        success: true,
        message: '정산할 주문이 없습니다',
        data: []
      });
    }

    // 파트너별로 그룹화
    const partnerGroups = orders.reduce((groups: any, order) => {
      const pId = order.partnerId;
      if (!pId) return groups;
      
      if (!groups[pId]) {
        groups[pId] = {
          partnerId: pId,
          partnerName: order.partner?.storeName || 'Unknown',
          commissionRate: order.partner?.commissionRate || 30,
          orders: []
        };
      }
      groups[pId].orders.push(order);
      return groups;
    }, {});

    // 각 파트너별로 정산 생성
    const settlements = [];
    
    for (const [pId, group] of Object.entries(partnerGroups) as any) {
      const totalSales = group.orders.reduce((sum: number, o: any) => sum + o.total, 0);
      const totalPartnerRevenue = group.orders.reduce((sum: number, o: any) => sum + (o.partnerRevenue || 0), 0);
      const platformRevenue = totalSales - totalPartnerRevenue;

      // 정산 생성
      const settlement = await prisma.settlement.create({
        data: {
          partnerId: group.partnerId,
          amount: totalPartnerRevenue,
          status: 'PENDING'
        }
      });

      // 주문에 정산 ID 연결
      // await prisma.order.updateMany({
      //   where: {
      //     id: {
      //       in: group.orders.map((o: any) => o.id)
      //     }
      //   },
      //   data: {
      //     settlementId: settlement.id
      //   }
      // });

      settlements.push(settlement);
    }

    return NextResponse.json({
      success: true,
      message: `${settlements.length}건의 정산이 생성되었습니다`,
      data: settlements
    });

  } catch (error) {
    console.error('Create settlements error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '정산 생성 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
