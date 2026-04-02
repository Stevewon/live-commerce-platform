import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';



// GET /api/admin/orders - 관리자 주문 목록 조회
export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // 관리자 권한 확인
    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    // 쿼리 파라미터
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'ALL';
    const search = searchParams.get('search') || '';
    const partnerId = searchParams.get('partnerId') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // 필터 조건 구성
    const where: any = {};

    if (status !== 'ALL') {
      where.status = status;
    }

    if (partnerId) {
      where.partnerId = partnerId;
    }

    // 검색어가 있으면 주문번호로만 필터링 + 사용자 검색은 후처리
    // (D1 래퍼가 nested relation 필터를 지원하지 않음)
    let searchUserIds: string[] | null = null;
    if (search) {
      // 1) 주문번호 필터
      const orderNumberFilter = { orderNumber: { contains: search } };

      // 2) 사용자 이름/이메일로 검색하여 userId 목록 확보
      try {
        const matchingUsers = await prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: search } },
              { nickname: { contains: search } },
              { email: { contains: search } },
            ],
          },
        });
        searchUserIds = matchingUsers.map((u: any) => u.id);
      } catch {
        searchUserIds = [];
      }

      // OR 조건: 주문번호 또는 매칭된 userId
      const orConditions: any[] = [orderNumberFilter];
      if (searchUserIds && searchUserIds.length > 0) {
        orConditions.push({ userId: { in: searchUserIds } });
      }
      where.OR = orConditions;
    }

    // 주문 목록 조회
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              email: true,
              nickname: true,
            },
          },
          partner: {
            select: {
              storeName: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  price: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    // user.name 이 null 일 수 있으므로 nickname 대체
    for (const order of orders as any[]) {
      if (order.user) {
        order.user.name = order.user.name || order.user.nickname || '미설정';
      }
    }

    return NextResponse.json({
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Admin orders list error:', error);
    return NextResponse.json({ error: '주문 목록 조회 실패' }, { status: 500 });
  }
}
