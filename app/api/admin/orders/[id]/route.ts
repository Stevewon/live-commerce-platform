import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuthToken } from '@/lib/auth/middleware';

const prisma = new PrismaClient();

// PATCH /api/admin/orders/[id] - 주문 상태 변경
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const { status } = body;

    // 유효한 상태 확인
    const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: '유효하지 않은 상태입니다' }, { status: 400 });
    }

    // 주문 존재 확인
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 });
    }

    // 취소 시 재고 복구
    if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
      for (const item of order.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            quantity: {
              increment: item.quantity,
            },
          },
        });
      }
    }

    // 주문 상태 업데이트
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        user: {
          select: {
            name: true,
            email: true,
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
    });

    return NextResponse.json({
      success: true,
      message: '주문 상태가 변경되었습니다',
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error('Admin order update error:', error);
    return NextResponse.json({ error: '주문 상태 변경 실패' }, { status: 500 });
  }
}

// GET /api/admin/orders/[id] - 주문 상세 조회
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (authResult.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const { id } = params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        partner: {
          select: {
            id: true,
            storeName: true,
            storeSlug: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                images: true,
              },
            },
          },
        },
        coupon: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error: any) {
    console.error('Admin order detail error:', error);
    return NextResponse.json({ error: '주문 상세 조회 실패' }, { status: 500 });
  }
}
