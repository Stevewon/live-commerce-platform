import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1 } from '@/lib/balance';
import { backfillOrderItemSnapshots } from '@/lib/orderItemSnapshot';



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

    // [상품 스냅샷] 컬럼 보장 + 기존 주문 백필 (멱등, 프로세스당 1회)
    //  → 어드민이 상품 삭제/변경 후에도 주문 상품명이 보여야 배송 가능
    try { await backfillOrderItemSnapshots(await getD1()); } catch { /* 실패해도 조회는 진행 */ }

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
    // ★ [2026-05-13 v1.0.18 HOTFIX] 증상 2 (어드민 TID/결제일시 미표시) 추측 방어 패치 ★
    //  1) D1 wrapper 가 일부 환경에서 include 만으로 paymentKey/paidAt/paymentMethod 누락하는 사례 제보
    //     → 명시적 select 추가로 모든 컬럼 강제 반환 보장 (어드민 화면 표시용 필드 누락 0)
    //  2) 응답 Cache-Control: no-store → 사장님 PC 브라우저/CDN 캐시 stale 차단
    //     → 결제 직후 어드민 새로고침 시 즉시 최신 paymentKey/paidAt 노출 보장
    //  ※ Prisma 의 select 와 include 는 동시 사용 가능하나 D1 wrapper 호환 위해 select 단독 사용
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          total: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          // ★ 증상 2 핵심 필드 — 절대 누락 금지
          paymentMethod: true,
          paymentKey: true,
          paidAt: true,
          refundAmount: true,
          refundedAt: true,
          cancelledAt: true,
          // 배송/연락처
          shippingName: true,
          shippingPhone: true,
          shippingAddress: true,
          trackingCompany: true,
          trackingNumber: true,
          // 비회원 정보
          guestEmail: true,
          guestPhone: true,
          guestOrderToken: true,
          // 관계 (회원/파트너/아이템)
          userId: true,
          partnerId: true,
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
            select: {
              id: true,
              quantity: true,
              price: true,
              productId: true,
              productName: true,
              productThumbnail: true,
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
    // ★ [2026-05-13 v1.0.19 HOTFIX] 증상 #4 (어드민 주문 클릭 오류) 백엔드 방어
    //   D1 wrapper 가 select 모드에서 items 관계 누락하거나 product=null 인 케이스 정규화
    //   → 클라이언트 selectedOrder.items.map(item.product.name) 접근 시 TypeError 차단
    for (const order of orders as any[]) {
      if (order.user) {
        order.user.name = order.user.name || order.user.nickname || '미설정';
      }
      // items 가 undefined/null 이면 빈 배열로 보장
      if (!Array.isArray(order.items)) {
        order.items = [];
      }
      // 각 item.product 가 null 인 경우, 주문 시점 스냅샷 상품명을 우선 사용
      //  → 상품이 삭제/변경돼도 어드민이 실제 상품명 보고 배송 가능
      for (const item of order.items) {
        const snapName = item.productName || '';
        if (!item.product) {
          item.product = { name: snapName || '주문 상품', price: item.price || 0 };
        } else {
          item.product.name = item.product.name || snapName || '주문 상품';
        }
      }
    }

    // [주문목록 최신순 보장] DB orderBy 가 wrapper/타임스탬프 이슈로 흔들려도
    //   항상 createdAt 내림차순(최신 먼저)으로 재정렬한다.
    (orders as any[]).sort(
      (a, b) =>
        new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
    );

    return NextResponse.json(
      {
        orders,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      {
        // ★ [2026-05-13 v1.0.18 HOTFIX] 사장님 PC 브라우저/CDN 캐시 stale 차단
        //  - 어드민 주문목록은 결제 직후 즉시 최신 상태 표시 필요
        //  - private = 브라우저 캐시 OK 이나 CDN 캐시 금지
        //  - no-store = 어떤 캐시도 저장 금지
        //  - max-age=0, must-revalidate = 매 요청 검증
        headers: {
          'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Admin orders list error:', error);
    return NextResponse.json({ error: '주문 목록 조회 실패' }, { status: 500 });
  }
}
