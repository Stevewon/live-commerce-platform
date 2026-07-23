import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { getD1 } from '@/lib/balance';
import { backfillOrderItemSnapshots } from '@/lib/orderItemSnapshot';

// GET /api/partner/orders - 파트너 주문 목록 조회
export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { userId, role } = authResult;

    if (role !== 'PARTNER') {
      return NextResponse.json(
        { success: false, error: '파트너 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 파트너 정보 조회
    const partner = await prisma.partner.findUnique({
      where: { userId },
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: '파트너 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 파트너 활성화 상태 확인
    if (!partner.isActive) {
      return NextResponse.json(
        { success: false, error: '파트너 승인 대기 중입니다. 관리자 승인 후 이용 가능합니다.' },
        { status: 403 }
      );
    }

    // 파트너의 주문 목록 조회
    const orders = await prisma.order.findMany({
      where: {
        partnerId: partner.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                thumbnail: true,
                price: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // [상품 스냅샷] 백필 (멱등) + 스냅샷 우선 정규화 (상품 삭제/변경돼도 상품명 유지)
    try { await backfillOrderItemSnapshots(await getD1()); } catch { /* 실패해도 진행 */ }
    for (const order of (orders as any[])) {
      for (const item of (order.items || [])) {
        const snapName = item.productName || '';
        const snapThumb = item.productThumbnail || '';
        if (!item.product) {
          item.product = { id: item.productId || '', name: snapName || '주문 상품', thumbnail: snapThumb || '', price: item.price || 0 };
        } else {
          item.product.name = item.product.name || snapName || '주문 상품';
          item.product.thumbnail = item.product.thumbnail || snapThumb || '';
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: orders,
    });
  } catch (error: any) {
    console.error('파트너 주문 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '주문 목록을 불러올 수 없습니다' },
      { status: 500 }
    );
  }
}
