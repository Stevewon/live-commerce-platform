import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { ensureOrderIndexes } from '@/lib/ensureProductColumns';

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

    // [PERF] 정산 조회 인덱스 셀프 힐링 (Settlement.partnerId/status)
    try { await ensureOrderIndexes(); } catch { /* 실패해도 조회는 진행 */ }

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const partnerId = searchParams.get('partnerId');

    // [2026-08-06 PERF/BUG FIX] 정산 목록
    // - 버그: 프론트(app/admin/settlements/page.tsx)는 응답의 `data.settlements` 를
    //   읽는데 API 는 `data` 로만 내려주고 있었음 → 정산 목록이 항상 비어 보임.
    //   프론트가 목록 전체로 통계 카드(전체/대기/승인/반려 금액)를 계산하므로,
    //   페이지네이션 대신 응답 필드명을 맞추고(settlements + data 동시 제공),
    //   무제한 로드 방지용 상한(take)만 둔다. (정산은 주문/회원만큼 폭증하지 않음)
    const takeCap = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || '500') || 500));

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
      },
      take: takeCap,
    });

    return NextResponse.json({
      success: true,
      settlements, // ★ 프론트 호환 (data.settlements)
      data: settlements, // 하위호환 유지
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
