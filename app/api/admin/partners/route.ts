import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';

// 관리자 파트너 조회 (GET)
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

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // 'active', 'inactive', 'all'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // 필터 조건
    const where: any = {};
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    // 파트너 조회
    const [partners, totalCount] = await Promise.all([
      prisma.partner.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              name: true,
              email: true,
              phone: true
            }
          },
          _count: {
            select: {
              products: true,
              orders: true
            }
          }
        }
      }),
      prisma.partner.count({ where })
    ]);

    // 각 파트너의 총 매출 계산
    const partnersWithStats = await Promise.all(
      partners.map(async (partner) => {
        const revenue = await prisma.order.aggregate({
          where: {
            partnerId: partner.id,
            status: { in: ['CONFIRMED', 'SHIPPING', 'DELIVERED'] }
          },
          _sum: { total: true }
        });

        return {
          ...partner,
          totalRevenue: revenue._sum.total || 0
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        partners: partnersWithStats,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });

  } catch (error) {
    console.error('관리자 파트너 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: '파트너 조회에 실패했습니다' },
      { status: 500 }
    );
  }
}
