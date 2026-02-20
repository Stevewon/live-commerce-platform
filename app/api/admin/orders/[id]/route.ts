import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuthToken } from '@/lib/auth/middleware';
import { notifyOrderStatusChange } from '@/lib/notifications';

// 주문 상태 변경 (PATCH)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { status } = await req.json();
    const { id: orderId } = await params;

    // 유효한 상태 확인
    const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 주문 상태입니다' },
        { status: 400 }
      );
    }

    // 주문 존재 확인
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 취소 또는 환불 시 재고 복구
    if ((status === 'CANCELLED' || status === 'REFUNDED') && 
        !['CANCELLED', 'REFUNDED'].includes(existingOrder.status)) {
      
      await prisma.$transaction(async (tx) => {
        // 주문 상태 업데이트
        await tx.order.update({
          where: { id: orderId },
          data: { status }
        });

        // 재고 복구
        for (const item of existingOrder.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity }
            }
          });
        }
      });

    } else {
      // 일반 상태 변경
      await prisma.order.update({
        where: { id: orderId },
        data: { status }
      });
    }

    // 업데이트된 주문 조회
    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        items: {
          include: {
            product: true
          }
        }
      }
    });
    
    // 알림 발송
    if (updatedOrder) {
      await notifyOrderStatusChange(
        updatedOrder.userId,
        updatedOrder.orderNumber,
        existingOrder.status,
        status
      );
    }

    return NextResponse.json({
      success: true,
      message: '주문 상태가 업데이트되었습니다',
      data: updatedOrder
    });

  } catch (error) {
    console.error('주문 상태 변경 실패:', error);
    return NextResponse.json(
      { success: false, error: '주문 상태 변경에 실패했습니다' },
      { status: 500 }
    );
  }
}
