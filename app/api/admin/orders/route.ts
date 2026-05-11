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

    // 검색어가 있으면 주문번호 / 수령인(배송정보) / 비회원 정보 / 회원 정보 전체 검색
    // 사장님 요청: 주문자/수령인/연락처 등 모두 검색 가능하게
    if (search) {
      // Order 테이블 직접 필드 검색 (주문번호, 수령인, 비회원 정보)
      const orConditions: any[] = [
        { orderNumber: { contains: search } },       // 주문번호
        { shippingName: { contains: search } },       // 수령인 이름 (받는사람)
        { shippingPhone: { contains: search } },      // 수령인 연락처
        { guestEmail: { contains: search } },         // 비회원 이메일
        { guestPhone: { contains: search } },         // 비회원 연락처
      ];

      // 회원(User) 이름/닉네임/이메일로 검색하여 userId 목록 확보
      // (D1 래퍼가 nested relation 필터를 지원하지 않으므로 2단계 검색)
      try {
        const matchingUsers = await prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: search } },
              { nickname: { contains: search } },
              { email: { contains: search } },
              { phone: { contains: search } },        // 회원 연락처
            ],
          },
          select: { id: true },
        });
        const searchUserIds = matchingUsers.map((u: any) => u.id);
        if (searchUserIds.length > 0) {
          orConditions.push({ userId: { in: searchUserIds } });
        }
      } catch {
        // User 검색 실패해도 다른 조건으로 계속 검색
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
